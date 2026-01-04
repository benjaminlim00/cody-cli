import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import type { Tool } from "./types.js";

/**
 * Tool: write_file
 * Creates or overwrites a file with the specified content.
 */
export const writeFileTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Create or overwrite a file with the given content. Creates parent directories if they don't exist.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path where the file should be written",
          },
          content: {
            type: "string",
            description: "The content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    },
  },

  async execute(args) {
    const path = args.path as string;
    const content = args.content as string;

    try {
      // Ensure parent directory exists
      await mkdir(dirname(path), { recursive: true });

      await writeFile(path, content, "utf-8");
      return {
        success: true,
        output: `Successfully wrote ${content.length} characters to ${path}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: `Failed to write file: ${message}`,
      };
    }
  },
};
