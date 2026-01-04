/**
 * Tool Registry
 *
 * Central registry of all tools available to Cody.
 * Provides the tool definitions (for the LLM) and execution functions.
 */

import type { Tool, ToolResult, FunctionToolDefinition } from "./types.js";
import { readFileTool } from "./readFile.js";
import { writeFileTool } from "./writeFile.js";
import { listDirectoryTool } from "./listDirectory.js";
import { runCommandTool } from "./runCommand.js";

// All available tools
const tools: Tool[] = [
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  runCommandTool,
];

// Map for quick lookup by name
const toolMap = new Map<string, Tool>(
  tools.map((tool) => [tool.definition.function.name, tool])
);

/**
 * Get all tool definitions to send to the LLM.
 * These tell the model what tools are available and how to call them.
 */
export function getToolDefinitions(): FunctionToolDefinition[] {
  return tools.map((tool) => tool.definition);
}

/**
 * Execute a tool by name with the given arguments.
 * Returns the result or an error message if the tool doesn't exist.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const tool = toolMap.get(name);

  if (!tool) {
    return {
      success: false,
      output: `Unknown tool: ${name}`,
    };
  }

  return tool.execute(args);
}

// Re-export types
export type { Tool, ToolResult } from "./types.js";
