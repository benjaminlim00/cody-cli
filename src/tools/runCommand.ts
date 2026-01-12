import { exec } from "child_process";
import { promisify } from "util";
import type { Tool } from "./types.js";
import { runtimeSettings } from "../config.js";

const execAsync = promisify(exec);

/**
 * Blocklist of dangerous command patterns.
 * These require user approval before execution.
 */
const BLOCKED_PATTERNS = [
  // Destructive file operations
  { pattern: /\brm\s+-rf\b/, reason: "Recursive force delete" },
  { pattern: /\brm\s+-r\b/, reason: "Recursive delete" },
  { pattern: /\brm\s+-f\b/, reason: "Force delete" },
  { pattern: /\brmdir\b/, reason: "Directory removal" },
  // System commands
  { pattern: /\bsudo\b/, reason: "Superuser command" },
  { pattern: /\bshutdown\b/, reason: "System shutdown" },
  { pattern: /\breboot\b/, reason: "System reboot" },
  { pattern: /\bkill\s+-9\b/, reason: "Force kill process" },
  { pattern: /\bkillall\b/, reason: "Kill all processes" },
  // Disk operations
  { pattern: /\bdd\b/, reason: "Low-level disk operation" },
  { pattern: /\bmkfs\b/, reason: "Filesystem creation" },
  // Network downloads piped to shell
  { pattern: /curl.*\|\s*(ba)?sh/, reason: "Remote script execution" },
  { pattern: /wget.*\|\s*(ba)?sh/, reason: "Remote script execution" },
  // Git destructive operations
  { pattern: /\bgit\s+push\s+.*--force\b/, reason: "Force push" },
  { pattern: /\bgit\s+reset\s+--hard\b/, reason: "Hard reset" },
];

/**
 * Check if a command matches any blocked pattern.
 */
function checkBlocklist(command: string): { pattern: RegExp; reason: string } | null {
  for (const blocked of BLOCKED_PATTERNS) {
    if (blocked.pattern.test(command)) {
      return blocked;
    }
  }
  return null;
}

/**
 * Tool: run_command
 * Executes a shell command and returns the output.
 *
 * Security: Dangerous commands require user approval via interactive prompt.
 */
export const runCommandTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Execute a shell command and return its output. Dangerous commands will prompt for user approval.",
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

    // Check against blocklist
    const blocked = checkBlocklist(command);
    if (blocked) {
      // If we have an approval callback, ask the user
      if (runtimeSettings.approvalCallback) {
        const response = await runtimeSettings.approvalCallback(
          command,
          blocked.reason
        );

        if (response.action === "no") {
          return {
            success: false,
            silent: true,
            output: `COMMAND NOT EXECUTED. User rejected the command "${command}". Do NOT claim it was run.`,
          };
        }

        if (response.action === "instruct") {
          return {
            success: false,
            silent: true,
            output: `COMMAND NOT EXECUTED. User rejected and said: "${response.message}". Do NOT claim the command was run.`,
          };
        }

        // action === "yes" - fall through to execute
      } else {
        // No callback available - block the command
        return {
          success: false,
          output: `⚠️  BLOCKED: "${command}" - ${blocked.reason}. Run interactively for approval prompt.`,
        };
      }
    }

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
