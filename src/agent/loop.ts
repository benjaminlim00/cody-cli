/**
 * Agent Loop
 *
 * This file contains the core "agentic" behavior - the loop that allows
 * an LLM to use tools iteratively until it completes a task.
 *
 * THE AGENTIC LOOP EXPLAINED:
 * ===========================
 *
 * Traditional chatbots: User asks → LLM responds → Done
 * Agentic systems:      User asks → LLM thinks → Uses tools → Observes results → Thinks again → ... → Done
 *
 * The key insight is that we keep the LLM "in the loop" - after each tool
 * execution, we send the results back and let it decide what to do next.
 * This continues until the LLM decides it has enough information to respond.
 */

import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import { client } from "./client.js";
import { config } from "../config.js";
import { getToolDefinitions, executeTool } from "../tools/index.js";

// Logging helpers for visibility
const log = {
  step: (msg: string) => console.log(`\n>> ${msg}`),
  tool: (name: string, args: unknown) =>
    console.log(`   🔧 Calling: ${name}(${JSON.stringify(args)})`),
  result: (output: string) => {
    const preview = output.length > 200 ? output.slice(0, 200) + "..." : output;
    console.log(`   ✓ Result: ${preview}`);
  },
  error: (msg: string) => console.log(`   ✗ Error: ${msg}`),
};

/**
 * System prompt that tells the LLM who it is and how to behave.
 * This is sent at the start of every conversation and shapes the LLM's behavior.
 */
const SYSTEM_PROMPT = `You are Cody, a helpful AI coding assistant. You help users with programming tasks by reading files, writing code, running commands, and exploring directories.

When given a task:
1. Think through what steps are needed
2. Use the available tools to accomplish the task
3. Explain what you did and show relevant results

Be concise but helpful. If something fails, explain what went wrong and suggest alternatives.`;

/**
 * Parse tool call arguments, handling potential JSON issues from local models.
 *
 * WHY THIS EXISTS:
 * ================
 * Cloud LLMs (GPT-4, Claude) produce perfect JSON. Local models sometimes don't.
 * Common issues include:
 *   - Missing quotes around strings: {path: hello.py} instead of {"path": "hello.py"}
 *   - Trailing commas: {"path": "hello.py",}
 *   - Single quotes: {'path': 'hello.py'}
 *
 * Rather than crashing, we try to fix these issues gracefully.
 */
function parseToolArguments(argsString: string): Record<string, unknown> {
  // STEP 1: Handle empty arguments
  if (!argsString || argsString.trim() === "") {
    return {};
  }

  // STEP 2: Try parsing as valid JSON first (the happy path)
  try {
    return JSON.parse(argsString);
  } catch {
    log.error(`Malformed JSON in tool arguments: ${argsString}`);

    // STEP 3: Attempt to fix common issues
    try {
      // Fix unquoted string values: {path: foo.txt} → {path: "foo.txt"}
      const fixed = argsString.replace(/: ([^",\{\}\[\]]+)([,\}])/g, ': "$1"$2');
      return JSON.parse(fixed);
    } catch {
      // STEP 4: Give up and return empty args (tool will likely fail gracefully)
      return {};
    }
  }
}

/**
 * Run the agent loop for a single user message.
 * Returns the final text response from the LLM.
 *
 * THIS IS THE HEART OF THE AGENT - READ THIS CAREFULLY!
 */
export async function runAgentLoop(userMessage: string): Promise<string> {
  // =========================================================================
  // STEP 1: INITIALIZE THE CONVERSATION
  // =========================================================================
  // We create an array to hold the conversation history. This is crucial
  // because LLMs are stateless - they don't remember previous calls.
  // We must send the ENTIRE conversation each time we call the API.
  //
  // The conversation starts with:
  //   - A "system" message that defines the AI's personality and capabilities
  //   - The "user" message containing their request
  //
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  // =========================================================================
  // STEP 2: PREPARE TOOLS
  // =========================================================================
  // Get the tool definitions (schemas) that tell the LLM what tools exist.
  // These are JSON schemas describing each tool's name, description, and parameters.
  // The LLM reads these to understand what it can do.
  //
  const tools = getToolDefinitions();

  // Safety limit - prevents infinite loops if the model keeps calling tools forever
  let iterationCount = 0;
  const maxIterations = 10;

  log.step("Sending request to LLM...");

  // =========================================================================
  // STEP 3: THE MAIN LOOP
  // =========================================================================
  // This loop continues until either:
  //   A) The LLM responds WITHOUT tool calls (it's done and wants to talk to the user)
  //   B) We hit the safety limit (something went wrong)
  //
  while (iterationCount < maxIterations) {
    iterationCount++;

    // =========================================================================
    // STEP 4: CALL THE LLM
    // =========================================================================
    // We send:
    //   - model: which LLM to use (configured in config.ts)
    //   - messages: the full conversation history so far
    //   - tools: the tool schemas so the LLM knows what's available
    //   - temperature: randomness (0 = deterministic, 1 = creative)
    //   - max_tokens: maximum response length
    //
    const response = await client.chat.completions.create({
      model: config.model,
      messages,
      tools,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    });

    // =========================================================================
    // STEP 5: EXTRACT THE LLM'S RESPONSE
    // =========================================================================
    // The response contains "choices" - usually just one.
    // Each choice has a "message" with the LLM's response.
    //
    const choice = response.choices[0];
    if (!choice) {
      throw new Error("No response from LLM");
    }

    const assistantMessage = choice.message;

    // =========================================================================
    // STEP 6: ADD RESPONSE TO HISTORY
    // =========================================================================
    // IMPORTANT: We add the assistant's message to our history BEFORE checking
    // if it contains tool calls. This maintains the correct conversation flow.
    //
    // The history now looks like:
    //   [system, user, assistant, ...]
    //
    messages.push(assistantMessage);

    // =========================================================================
    // STEP 7: CHECK FOR TOOL CALLS
    // =========================================================================
    // The LLM's response can contain:
    //   A) Just text (content) - This means it wants to respond to the user
    //   B) Tool calls - This means it wants to use tools before responding
    //   C) Both - It might say something AND call tools
    //
    // If there are NO tool calls, the loop is done!
    //
    const toolCalls = assistantMessage.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      // =====================================================================
      // STEP 7a: NO TOOL CALLS - WE'RE DONE!
      // =====================================================================
      // The LLM has decided it has enough information and wants to respond.
      // Return the text content to show the user.
      //
      log.step("LLM finished (no more tool calls)");
      return assistantMessage.content || "(no response)";
    }

    // =========================================================================
    // STEP 8: PROCESS TOOL CALLS
    // =========================================================================
    // The LLM wants to use tools. Each tool call contains:
    //   - id: A unique identifier (we need this to match results later)
    //   - type: "function" (we only support function tools)
    //   - function.name: Which tool to call (e.g., "read_file")
    //   - function.arguments: JSON string of arguments (e.g., '{"path": "hello.py"}')
    //
    log.step(`LLM requested ${toolCalls.length} tool call(s):`);

    const toolResults: ChatCompletionToolMessageParam[] = [];

    for (const toolCall of toolCalls) {
      // Skip non-function tool calls (we only support function tools)
      if (toolCall.type !== "function") {
        continue;
      }

      // =====================================================================
      // STEP 8a: PARSE THE TOOL CALL
      // =====================================================================
      // Extract the tool name and parse the JSON arguments.
      // The arguments come as a string, so we need to parse them.
      //
      const toolName = toolCall.function.name;
      const toolArgs = parseToolArguments(toolCall.function.arguments);

      log.tool(toolName, toolArgs);

      // =====================================================================
      // STEP 8b: EXECUTE THE TOOL
      // =====================================================================
      // Actually run the tool! This is where real work happens:
      //   - read_file: reads from disk
      //   - write_file: writes to disk
      //   - list_directory: lists files
      //   - run_command: executes shell commands
      //
      const result = await executeTool(toolName, toolArgs);

      if (result.success) {
        log.result(result.output);
      } else {
        log.error(result.output);
      }

      // =====================================================================
      // STEP 8c: FORMAT THE RESULT FOR THE LLM
      // =====================================================================
      // We create a "tool" message that pairs the result with the original
      // tool call ID. This is how the LLM knows which result goes with which call.
      //
      // Structure:
      //   {
      //     role: "tool",           // Special role for tool results
      //     tool_call_id: "...",    // Matches the original request
      //     content: "..."          // The actual result/output
      //   }
      //
      toolResults.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result.output,
      });
    }

    // =========================================================================
    // STEP 9: ADD TOOL RESULTS TO CONVERSATION
    // =========================================================================
    // Add all tool results to the conversation history.
    //
    // The history now looks like:
    //   [system, user, assistant (with tool_calls), tool, tool, ...]
    //
    // On the next iteration, the LLM will see its previous request AND
    // the results, allowing it to continue reasoning.
    //
    messages.push(...toolResults);

    log.step("Sending tool results back to LLM...");

    // =========================================================================
    // STEP 10: LOOP BACK TO STEP 4
    // =========================================================================
    // The while loop continues. We'll call the LLM again with the updated
    // conversation. The LLM will see:
    //   - The original user request
    //   - Its previous tool calls
    //   - The results of those calls
    //
    // It can then decide to:
    //   - Call more tools (loop continues)
    //   - Respond to the user (loop ends)
    //
  }

  // =========================================================================
  // STEP 11: SAFETY EXIT
  // =========================================================================
  // If we get here, the LLM called tools too many times without finishing.
  // This usually indicates a problem (confused model, infinite loop, etc.)
  //
  log.error(`Hit maximum iterations (${maxIterations})`);
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && "content" in lastMessage && typeof lastMessage.content === "string") {
    return lastMessage.content;
  }
  return "(agent stopped - too many iterations)";
}
