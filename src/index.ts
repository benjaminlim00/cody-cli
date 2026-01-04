#!/usr/bin/env node
/**
 * Cody CLI - A simple AI coding agent
 *
 * This is the main entry point that creates an interactive chat interface.
 * Users can type messages, and Cody will use tools to help with coding tasks.
 */

import * as readline from "readline";
import { config, runtimeSettings } from "./config.js";
import { runAgentLoop, Conversation } from "./agent/index.js";

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
║   Your AI Coding Assistant                                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
  console.log(`Connected to: ${config.baseUrl}`);
  console.log(`Model: ${config.model}`);
  console.log(
    `\nCommands: "exit" to quit, "/show-thinking" to toggle reasoning, "/new" to clear memory\n`
  );
}

// ============================================================================
// MAIN CHAT LOOP
// ============================================================================
// Creates a readline interface for user input and processes each message
// through the agent loop.
//
async function main(): Promise<void> {
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

  // Main input loop
  while (true) {
    // Get user input
    const userInput = await askQuestion("You: ");

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
      console.log(`\n[Thinking display: ${runtimeSettings.showThinking ? "ON" : "OFF"}]\n`);
      continue;
    }

    // Check for /new command
    if (input === "/new") {
      conversation.reset();
      console.log(`\n[Conversation memory cleared]\n`);
      continue;
    }

    // Unknown slash command - show available commands
    if (input.startsWith("/")) {
      console.log(`
Unknown command: ${input}

Available commands:
  /show-thinking  Toggle display of model reasoning
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

      // Display Cody's response
      console.log(`\n${"─".repeat(60)}`);
      console.log("Cody:", response);
      console.log(`${"─".repeat(60)}\n`);
    } catch (error) {
      // Handle errors gracefully
      console.error("\n[Error]", error instanceof Error ? error.message : error);
      console.log("Something went wrong. Please try again.\n");
    }
  }
}

// Run the CLI
main();
