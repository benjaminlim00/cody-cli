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

import type { ChatCompletionToolMessageParam } from "openai/resources/chat/completions";
import { client } from "./client.js";
import { config, runtimeSettings } from "../config.js";
import { getToolDefinitions, executeTool } from "../tools/index.js";
import { Conversation } from "./conversation.js";
import { colors } from "../utils/colors.js";
import { spinner } from "../utils/spinner.js";
import { truncateOutput } from "../tools/validation.js";

/**
 * Truncate tool arguments for display (e.g., don't show entire file content)
 */
function truncateToolArgs(args: unknown): unknown {
  if (!args || typeof args !== "object") return args;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    if (typeof value === "string" && value.length > 100) {
      result[key] = value.slice(0, 100) + `... (${value.length} chars)`;
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Logging helpers for visibility (most only show when debug is on)
const log = {
  // Status always shows - cyan for active status
  status: (msg: string) => console.log(`\n${colors.cyan}>> ${msg}${colors.reset}`),
  // Steps only in debug - gray for secondary info
  step: (msg: string) => {
    if (runtimeSettings.debug) console.log(`\n${colors.gray}>> ${msg}${colors.reset}`);
  },
  // Tool calls - cyan for actions (truncate large args like file content)
  tool: (name: string, args: unknown) => {
    if (runtimeSettings.debug) {
      const truncatedArgs = truncateToolArgs(args);
      console.log(`   ${colors.cyan}🔧 ${name}${colors.reset}(${JSON.stringify(truncatedArgs)})`);
    }
  },
  // Results - green for success
  result: (output: string) => {
    if (runtimeSettings.debug) {
      const preview = output.length > 200 ? output.slice(0, 200) + "..." : output;
      console.log(`   ${colors.green}✓ ${preview}${colors.reset}`);
    }
  },
  // Errors - red for failures
  error: (msg: string) => console.log(`   ${colors.red}✗ Error: ${msg}${colors.reset}`),
  // Debug - yellow for attention
  debug: (msg: string, data?: unknown) => {
    if (runtimeSettings.debug) {
      console.log(`   ${colors.yellow}[Debug] ${msg}${colors.reset}`);
      if (data !== undefined) console.log(`   ${colors.yellow}[Debug]${colors.reset}`, data);
    }
  },
};

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
      // Regex matches `: value,` or `: value}` where value has no quotes/braces/brackets
      const fixed = argsString.replace(
        /: ([^",\{\}\[\]]+)([,\}])/g,
        ': "$1"$2'
      );
      return JSON.parse(fixed);
    } catch {
      // STEP 4: Give up and return empty args (tool will likely fail gracefully)
      return {};
    }
  }
}

/**
 * Process thinking tags from model output.
 *
 * WHY THIS EXISTS:
 * ================
 * Some local models (like Nemotron, DeepSeek, Qwen) output their chain-of-thought
 * reasoning inside  without the opening tag, so we handle both cases.
 */
function processThinkingTags(content: string): string {
  // Extract thinking content and main response
  let thinking = "";
  let response = content;

  // Case 1: Full <think>...</think> blocks
  const fullMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  if (fullMatch) {
    thinking = fullMatch[1].trim();
    response = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  } else {
    // Case 2: Everything before </think> (when opening tag is missing)
    const partialMatch = content.match(/^([\s\S]*?)<\/think>/);
    if (partialMatch) {
      thinking = partialMatch[1].trim();
      response = content.replace(/^[\s\S]*?<\/think>/g, "").trim();
    }
  }

  // If user wants to see thinking, format it nicely
  if (runtimeSettings.showThinking && thinking) {
    const thinkingHeader = `${colors.yellow}── Thinking ──${colors.reset}`;
    const thinkingContent = `${colors.blue}${thinking}${colors.reset}`;
    const responseHeader = `${colors.green}── Response ──${colors.reset}`;
    return `${thinkingHeader}\n${thinkingContent}\n\n${responseHeader}\n${response}`;
  }

  return response;
}

/**
 * Run the agent loop for a single user message.
 * Returns the final text response from the LLM.
 *
 * THIS IS THE HEART OF THE AGENT - READ THIS CAREFULLY!
 *
 * @param conversation - The conversation state (maintains history across calls)
 * @param userMessage - The user's current message
 */
export async function runAgentLoop(
  conversation: Conversation,
  userMessage: string,
  options: { bossMode?: boolean } = {}
): Promise<string> {
  // =========================================================================
  // STEP 1: ADD USER MESSAGE TO CONVERSATION
  // =========================================================================
  // The conversation object maintains history across multiple user interactions.
  // We add the new user message to the existing history, so the LLM can
  // reference previous messages in the session.
  //
  conversation.addUserMessage(userMessage);

  // =========================================================================
  // STEP 2: PREPARE TOOLS
  // =========================================================================
  // Get the tool definitions (schemas) that tell the LLM what tools exist.
  // These are JSON schemas describing each tool's name, description, and parameters.
  // The LLM reads these to understand what it can do.
  //
  const tools = getToolDefinitions();

  // Safety limit - prevents infinite loops if the model keeps calling tools forever
  // In boss mode, we don't cap iterations (the outer boss loop handles continuation)
  let iterationCount = 0;
  const maxIterations = options.bossMode ? Infinity : 10;

  const spinnerMessage = options.bossMode
    ? "[BOSS MODE] Working... (ESC to exit)"
    : "Thinking...";
  spinner.start(spinnerMessage);

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
    log.debug(`API Request to ${config.baseUrl}`);
    log.debug(`Model: ${config.model}, Provider: ${config.provider}`);
    log.debug(`Messages count: ${conversation.getMessages().length}`);

    const response = await client.chat.completions.create({
      model: config.model,
      messages: conversation.getMessages(),
      tools,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    });

    log.debug(`API Response received`, {
      id: response.id,
      model: response.model,
    });

    // =========================================================================
    // STEP 5: EXTRACT THE LLM'S RESPONSE
    // =========================================================================
    // The response contains "choices" - usually just one.
    // Each choice has a "message" with the LLM's response.
    //
    // Handle malformed responses (common with rate limiting or API errors)
    if (!response || !response.choices || !Array.isArray(response.choices)) {
      spinner.stop();
      log.error("API returned malformed response (possibly rate limited)");
      log.debug("Response object:", response);
      throw new Error("API returned malformed response - try again or check rate limits");
    }

    const choice = response.choices[0];
    if (!choice || !choice.message) {
      spinner.stop();
      log.error("API returned empty choices array");
      throw new Error("No response from LLM - context may be too large");
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
    conversation.addAssistantMessage(assistantMessage);

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
      spinner.stop();
      log.step("LLM finished (no more tool calls)");
      return processThinkingTags(assistantMessage.content || "(no response)");
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
      // Update spinner to show which tool is running (helpful in boss mode)
      if (options.bossMode) {
        spinner.update(`[BOSS MODE] Running ${toolName}... (ESC to exit)`);
      }

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
      // SECURITY: Truncate large outputs to prevent context window overflow
      const truncatedOutput = truncateOutput(result.output, 5000);

      toolResults.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: truncatedOutput,
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
    conversation.addToolResults(toolResults);

    log.step("Sending tool results back to LLM...");

    // Reset spinner for next LLM call
    if (options.bossMode) {
      spinner.update("[BOSS MODE] Working... (ESC to exit)");
    }

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
  spinner.stop();
  log.error(`Hit maximum iterations (${maxIterations})`);
  const messages = conversation.getMessages();
  const lastMessage = messages[messages.length - 1];
  if (
    lastMessage &&
    "content" in lastMessage &&
    typeof lastMessage.content === "string"
  ) {
    return processThinkingTags(lastMessage.content);
  }
  return "(agent stopped - too many iterations)";
}
