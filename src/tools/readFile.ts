import { readFile, stat } from "fs/promises";
import type { Tool } from "./types.js";

/**
 * Tool: read_file
 * Reads the contents of a file and returns it as text.
 */
export const readFileTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the contents of a file at the specified path. Returns the file contents as text.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to the file to read (relative or absolute)",
          },
        },
        required: ["path"],
      },
    },
  },

  async execute(args) {
    const path = args.path as string;

    try {
      // Check if path is a directory
      const stats = await stat(path);
      if (stats.isDirectory()) {
        return {
          success: false,
          output: `Error: "${path}" is a directory, not a file. Use list_directory to see its contents.`,
        };
      }

      const content = await readFile(path, "utf-8");
      return {
        success: true,
        output: content,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: `Failed to read file: ${message}`,
      };
    }
  },
};
