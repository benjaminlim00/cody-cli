/**
 * Result returned after executing a tool.
 * Tools should return a string (success message or content)
 * or throw an error if something goes wrong.
 */
export interface ToolResult {
  success: boolean;
  output: string;
}

/**
 * OpenAI function tool definition.
 * This is the schema we send to the LLM to describe available tools.
 */
export interface FunctionToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, {
        type: string;
        description: string;
      }>;
      required?: string[];
    };
  };
}

/**
 * A tool that Cody can use.
 * Combines the OpenAI schema (for the LLM) with the actual implementation.
 */
export interface Tool {
  // The schema sent to the LLM - tells it what the tool does and what arguments it needs
  definition: FunctionToolDefinition;

  // The actual function that runs when the tool is called
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
}
