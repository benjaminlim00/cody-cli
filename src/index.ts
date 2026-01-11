#!/usr/bin/env node
/**
 * Cody CLI - A simple AI coding agent
 *
 * This is the main entry point that creates an interactive chat interface.
 * Users can type messages, and Cody will use tools to help with coding tasks.
 */

import * as readline from "readline";
import { config, runtimeSettings } from "./config.js";
import { runAgentLoop, Conversation, client } from "./agent/index.js";
import { renderContent } from "./utils/index.js";
import { BOSS_CONTINUATION_PROMPT, ESC_KEY, bossMessages } from "./boss.js";

// ============================================================================
// WELCOME MESSAGE
// ============================================================================
// Show a friendly banner when Cody starts up.
//
function showWelcome(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██████╗ ██████╗ ██████╗ ██╗   ██╗                       ║
║  ██╔════╝██╔═══██╗██╔══██╗╚██╗ ██╔╝                       ║
║  ██║     ██║   ██║██║  ██║ ╚████╔╝                        ║
║  ██║     ██║   ██║██║  ██║  ╚██╔╝                         ║
║  ╚██████╗╚██████╔╝██████╔╝   ██║                          ║
║   ╚═════╝ ╚═════╝ ╚═════╝    ╚═╝                          ║
║                                                           ║
║   Open Source Coding CLI                                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
  console.log(`Connected to: ${config.baseUrl}`);
  console.log(`Model: ${config.model}`);
  console.log(
    `\nCommands: "/boss" for autonomous mode, "/show-thinking" to toggle reasoning, "/debug" for debug logs, "/new" to clear memory, "exit" to quit\n`
  );
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
    // We decide user prefix here
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

    // Unknown slash command - show available commands
    if (input.startsWith("/")) {
      console.log(`
Unknown command: ${input}

Available commands:
  /boss           Enter autonomous boss mode (ESC to exit)
  /show-thinking  Toggle display of model reasoning
  /debug          Toggle debug mode for extra logs
  /new            Clear conversation memory and start fresh
  exit            Quit Cody
`);
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
