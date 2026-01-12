#!/usr/bin/env node
/**
 * Cody CLI - A simple AI coding agent
 *
 * This is the main entry point that creates an interactive chat interface.
 * Users can type messages, and Cody will use tools to help with coding tasks.
 */

import * as readline from "readline";
import { config, runtimeSettings, type ApprovalResponse } from "./config.js";
import { runAgentLoop, Conversation, client } from "./agent/index.js";
import { renderContent } from "./utils/index.js";
import { BOSS_CONTINUATION_PROMPT, ESC_KEY, bossMessages } from "./boss.js";
import { colors } from "./utils/colors.js";
import { spinner } from "./utils/spinner.js";

// ============================================================================
// WELCOME MESSAGE
// ============================================================================
// Show a friendly banner when Cody starts up.
//
/**
 * Returns formatted command list for help display.
 */
function getCommandList(): string {
  return `
  ${colors.green}/boss${colors.reset}           Autonomous mode - Cody works on todos.md
  ${colors.green}/show-thinking${colors.reset}  Toggle model reasoning display
  ${colors.green}/debug${colors.reset}          Toggle debug logs
  ${colors.green}/new${colors.reset}            Clear conversation memory
  ${colors.green}/help${colors.reset}           Show all commands
  ${colors.green}exit${colors.reset}            Quit Cody`;
}

function showWelcome(): void {
  console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════════╗
║                                                           ║${colors.reset}
${colors.cyan}║${colors.reset}   ${colors.magenta}██████╗ ██████╗ ██████╗ ██╗   ██╗${colors.reset}                       ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}  ${colors.magenta}██╔════╝██╔═══██╗██╔══██╗╚██╗ ██╔╝${colors.reset}                       ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}  ${colors.magenta}██║     ██║   ██║██║  ██║ ╚████╔╝${colors.reset}                        ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}  ${colors.magenta}██║     ██║   ██║██║  ██║  ╚██╔╝${colors.reset}                         ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}  ${colors.magenta}╚██████╗╚██████╔╝██████╔╝   ██║${colors.reset}                          ${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}   ${colors.magenta}╚═════╝ ╚═════╝ ╚═════╝    ╚═╝${colors.reset}                          ${colors.cyan}║${colors.reset}
${colors.cyan}║                                                           ║
║${colors.reset}   ${colors.yellow}Open Source Coding CLI${colors.reset}                                  ${colors.cyan}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`);
  console.log(`${colors.gray}Connected to:${colors.reset} ${colors.green}${config.baseUrl}${colors.reset}`);
  console.log(`${colors.gray}Model:${colors.reset} ${colors.green}${config.model}${colors.reset}`);
  console.log(`\n${colors.cyan}Commands:${colors.reset}${getCommandList()}\n`);
}

// ============================================================================
// COMMANDS HELP
// ============================================================================
function showHelp(): void {
  console.log(`\n${colors.cyan}Available Commands:${colors.reset}${getCommandList()}\n`);
}

// ============================================================================
// APPROVAL PROMPT
// ============================================================================
// Interactive prompt for blocked commands. Uses the main readline to avoid
// conflicts with multiple readline instances on stdin.

// Reference to main readline - set in main()
let mainRl: readline.Interface | null = null;

/**
 * Promisified question using the main readline.
 */
function askApprovalQuestion(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    if (!mainRl) {
      // Fallback if readline not available
      process.stdout.write(prompt);
      process.stdin.once("data", (data) => resolve(data.toString().trim()));
      return;
    }
    mainRl.question(prompt, resolve);
  });
}

/**
 * Show approval prompt for blocked commands.
 * Uses the main readline instance to avoid stdin conflicts.
 */
async function createApprovalPrompt(
  blockedItem: string,
  reason: string
): Promise<ApprovalResponse> {
  // Stop the spinner so user can see the prompt
  spinner.stop();

  // Ensure stdin is active
  process.stdin.resume();

  console.log(`\n${colors.yellow}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.yellow}║  ⚠️  APPROVAL REQUIRED                                      ║${colors.reset}`);
  console.log(`${colors.yellow}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\n${colors.red}Command:${colors.reset} ${blockedItem}`);
  console.log(`${colors.red}Reason:${colors.reset}  ${reason}\n`);
  console.log(`${colors.cyan}Options:${colors.reset}`);
  console.log(`  ${colors.green}[1]${colors.reset} Yes - Execute the command`);
  console.log(`  ${colors.red}[2]${colors.reset} No - Cancel the command`);
  console.log(`  ${colors.blue}[3]${colors.reset} Tell Cody what to do instead\n`);

  const askChoice = async (): Promise<ApprovalResponse> => {
    const answer = await askApprovalQuestion(`${colors.cyan}Enter choice (1/2/3):${colors.reset} `);
    const choice = answer.trim();

    if (choice === "1" || choice.toLowerCase() === "yes" || choice.toLowerCase() === "y") {
      console.log(`${colors.green}✓ Approved${colors.reset}\n`);
      spinner.start("Thinking...");
      return { action: "yes" };
    } else if (choice === "2" || choice.toLowerCase() === "no" || choice.toLowerCase() === "n") {
      console.log(`${colors.red}✗ Cancelled${colors.reset}\n`);
      spinner.start("Thinking...");
      return { action: "no" };
    } else if (choice === "3") {
      const instruction = await askApprovalQuestion(`${colors.blue}Tell Cody what to do:${colors.reset} `);
      console.log(`${colors.blue}→ Instruction received${colors.reset}\n`);
      spinner.start("Thinking...");
      return { action: "instruct", message: instruction.trim() };
    } else {
      console.log(`${colors.gray}Please enter 1, 2, or 3${colors.reset}`);
      return askChoice();
    }
  };

  return askChoice();
}

// ============================================================================
// BOSS MODE
// ============================================================================
// Autonomous operation until ESC is pressed.
//
async function startBossMode(
  conversation: Conversation
): Promise<void> {
  console.log(bossMessages.activated);

  // Enable boss mode
  runtimeSettings.bossMode = true;
  runtimeSettings.bossInterrupted = false;

  // Store original stdin state
  const wasRaw = process.stdin.isRaw;

  // Set up ESC key listener
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  const onKeypress = (key: Buffer) => {
    if (key.toString() === ESC_KEY) {
      runtimeSettings.bossInterrupted = true;
      console.log('\n[ESC pressed - exiting boss mode after current action...]\n');
    }
  };
  process.stdin.on('data', onKeypress);

  let cycle = 0;

  try {
    // Initial prompt to kick things off
    let prompt = BOSS_CONTINUATION_PROMPT;

    while (!runtimeSettings.bossInterrupted) {
      cycle++;
      console.log(bossMessages.cycle(cycle));
      console.log("─".repeat(60));

      try {
        const response = await runAgentLoop(conversation, prompt, { bossMode: true });
        const renderedResponse = renderContent(response);
        console.log(`\n◆ ${renderedResponse}\n`);

        // Auto-compact conversation if it's getting too large
        if (conversation.needsCompaction()) {
          console.log(`[Compacting conversation - ${conversation.getMessageCount()} messages]`);
          await conversation.compact(client, config.model);
        }
      } catch (error) {
        console.error("\n[Error]", error instanceof Error ? error.message : error);
        console.log("Continuing to next cycle...\n");
      }

      // Check if interrupted during the cycle
      if (runtimeSettings.bossInterrupted) {
        break;
      }

      // Continue with the standard continuation prompt
      prompt = BOSS_CONTINUATION_PROMPT;
    }
  } finally {
    // Clean up: restore stdin state
    process.stdin.removeListener('data', onKeypress);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(wasRaw ?? false);
    }

    // Disable boss mode
    runtimeSettings.bossMode = false;
    runtimeSettings.bossInterrupted = false;

    console.log(bossMessages.deactivated);
  }
}

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================
function parseArgs(): { bossMode: boolean } {
  const args = process.argv.slice(2);
  return {
    bossMode: args.includes('--boss'),
  };
}

// ============================================================================
// MAIN CHAT LOOP
// ============================================================================
// Creates a readline interface for user input and processes each message
// through the agent loop.
//
async function main(): Promise<void> {
  const args = parseArgs();
  showWelcome();

  // Create conversation state - persists across messages in the session
  const conversation = new Conversation();

  // Create readline interface for terminal input/output with history support
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 100,
    terminal: true,
  });

  // Store reference for approval prompts
  mainRl = rl;

  // Set up approval callback for blocked commands
  runtimeSettings.approvalCallback = createApprovalPrompt;

  // Access history array (exists at runtime but not in TS types)
  const history = (rl as unknown as { history: string[] }).history;

  // Promisified question function for async/await usage
  const askQuestion = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        // Add to history for up-arrow recall (if non-empty)
        if (answer.trim() && history && !history.includes(answer)) {
          history.unshift(answer);
        }
        resolve(answer);
      });
    });
  };

  // Start in boss mode if --boss flag was passed
  if (args.bossMode) {
    await startBossMode(conversation);
  }

  // Main input loop
  while (true) {
    // Get user input
    console.log("─".repeat(60));
    const userInput = await askQuestion("> ");
    console.log("─".repeat(60));

    const input = userInput.trim().toLowerCase();

    // Check for exit command
    if (input === "exit") {
      console.log("\nGoodbye! Happy coding!\n");
      rl.close();
      break;
    }

    // Check for /show-thinking command
    if (input === "/show-thinking") {
      runtimeSettings.showThinking = !runtimeSettings.showThinking;
      console.log(
        `\n[Thinking display: ${runtimeSettings.showThinking ? "ON" : "OFF"}]\n`
      );
      continue;
    }

    // Check for /debug command
    if (input === "/debug") {
      runtimeSettings.debug = !runtimeSettings.debug;
      console.log(`\n[Debug mode: ${runtimeSettings.debug ? "ON" : "OFF"}]\n`);
      continue;
    }

    // Check for /new command
    if (input === "/new") {
      conversation.reset();
      console.log(`\n[Conversation memory cleared]\n`);
      continue;
    }

    // Check for /boss command
    if (input === "/boss") {
      await startBossMode(conversation);
      continue;
    }

    // Check for /help command
    if (input === "/help") {
      showHelp();
      continue;
    }

    // Unknown slash command - show available commands
    if (input.startsWith("/")) {
      console.log(`\n${colors.red}Unknown command:${colors.reset} ${input}`);
      showHelp();
      continue;
    }

    // Skip empty input
    if (!userInput.trim()) {
      continue;
    }

    try {
      // Run the agent loop and get the response
      const response = await runAgentLoop(conversation, userInput);

      // Render and display the response
      const renderedResponse = renderContent(response);
      // We decide Cody prefix here
      console.log(`\n◆ ${renderedResponse}\n`);

      // IMPORTANT: The ora spinner library pauses stdin when it stops.
      // Without this, Node's event loop has no active handles and exits with code 0.
      process.stdin.resume();
    } catch (error) {
      // Handle errors gracefully
      console.error(
        "\n[Error]",
        error instanceof Error ? error.message : error
      );
      if (runtimeSettings.debug && error instanceof Error) {
        console.error("\n[Debug] Full error details:");
        console.error(error);
        if ("status" in error)
          console.error(
            "[Debug] HTTP Status:",
            (error as { status: number }).status
          );
        if ("code" in error)
          console.error(
            "[Debug] Error Code:",
            (error as { code: string }).code
          );
      }
      console.log("Something went wrong. Please try again.\n");
    }
  }
}

// Run the CLI
main();
