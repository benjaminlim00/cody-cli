import { readdir, stat } from "fs/promises";
import { join } from "path";
import type { Tool } from "./types.js";

/**
 * Tool: list_directory
 * Lists files and directories at the specified path.
 */
export const listDirectoryTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "list_directory",
      description:
        "List all files and directories at the specified path. Shows file types (file/directory) for each entry.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "The directory path to list (defaults to current directory if not specified)",
          },
        },
        required: [],
      },
    },
  },

  async execute(args) {
    const path = (args.path as string) || ".";

    try {
      const entries = await readdir(path);

      // Get details for each entry
      const details = await Promise.all(
        entries.map(async (entry) => {
          try {
            const fullPath = join(path, entry);
            const stats = await stat(fullPath);
            const type = stats.isDirectory() ? "[dir]" : "[file]";
            return `${type} ${entry}`;
          } catch {
            return `[?] ${entry}`;
          }
        })
      );

      if (details.length === 0) {
        return {
          success: true,
          output: `Directory "${path}" is empty`,
        };
      }

      return {
        success: true,
        output: details.join("\n"),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: `Failed to list directory: ${message}`,
      };
    }
  },
};
