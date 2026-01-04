import { exec } from "child_process";
import { promisify } from "util";
import type { Tool } from "./types.js";

const execAsync = promisify(exec);

/**
 * Tool: run_command
 * Executes a shell command and returns the output.
 *
 * ⚠️  Security note: This executes arbitrary commands!
 * In a production agent, you'd want approval workflows or sandboxing.
 */
export const runCommandTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Execute a shell command and return its output. Use for running scripts, installing packages, git commands, etc.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute",
          },
        },
        required: ["command"],
      },
    },
  },

  async execute(args) {
    const command = args.command as string;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB max output
      });

      // Combine stdout and stderr for complete output
      const output = [stdout, stderr].filter(Boolean).join("\n").trim();

      return {
        success: true,
        output: output || "(command completed with no output)",
      };
    } catch (error) {
      // exec errors include exit codes and stderr
      if (error && typeof error === "object" && "stderr" in error) {
        const execError = error as { stderr: string; code?: number };
        return {
          success: false,
          output: `Command failed (exit code ${execError.code ?? "unknown"}): ${execError.stderr}`,
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: `Failed to execute command: ${message}`,
      };
    }
  },
};
