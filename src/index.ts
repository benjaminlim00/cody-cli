/**
 * Cody CLI - A simple AI coding agent
 *
 * This is the main entry point that creates an interactive chat interface.
 * Users can type messages, and Cody will use tools to help with coding tasks.
 */

import * as readline from "readline";
import { config } from "./config.js";
import { runAgentLoop } from "./agent/index.js";

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
  console.log(`\nType your request and press Enter. Type "exit" to quit.\n`);
}

// ============================================================================
// MAIN CHAT LOOP
// ============================================================================
// Creates a readline interface for user input and processes each message
// through the agent loop.
//
async function main(): Promise<void> {
  showWelcome();

  // Create readline interface for terminal input/output
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Promisified question function for async/await usage
  const askQuestion = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  };

  // Main input loop
  while (true) {
    // Get user input
    const userInput = await askQuestion("You: ");

    // Check for exit command
    if (userInput.toLowerCase().trim() === "exit") {
      console.log("\nGoodbye! Happy coding!\n");
      rl.close();
      break;
    }

    // Skip empty input
    if (!userInput.trim()) {
      continue;
    }

    try {
      // Run the agent loop and get the response
      const response = await runAgentLoop(userInput);

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
