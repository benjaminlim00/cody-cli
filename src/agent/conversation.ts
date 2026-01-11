/**
 * Conversation State Manager
 *
 * Maintains message history across multiple user interactions,
 * giving the LLM memory of previous messages in the session.
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type OpenAI from "openai";

// Compact conversation when it exceeds this many messages
export const COMPACTION_THRESHOLD = 30;

const COMPACTION_PROMPT = `Summarize the conversation so far in a concise way that preserves:
1. What tasks were completed
2. What files were created/modified
3. Current state of any ongoing work
4. Key decisions made

Keep it under 500 words. Format as a brief status report.`;

const getSystemPrompt = () => `You are Cody, an open source coding CLI.

Working directory: ${process.cwd()}

IMPORTANT: You are an AGENT that takes ACTION. Don't just describe what to do - DO IT.
- When asked to fix/change/add something: READ the file, then WRITE the changes
- When asked to refactor: UPDATE all related files, not just the one mentioned
- When asked to create something: WRITE the file, don't just show code
- Only explain without acting if explicitly asked to "explain" or "describe"

Workflow:
1. List directory to understand project structure
2. Read files before modifying them
3. Write changes directly - don't ask permission for code edits
4. Run commands to verify (build, test, lint) when appropriate

Be concise. Show what you changed, not what you're going to change.`;

/**
 * Conversation class that maintains message history.
 */
export class Conversation {
  private messages: ChatCompletionMessageParam[] = [];

  constructor() {
    this.reset();
  }

  /**
   * Reset conversation to initial state (just system prompt).
   */
  reset(): void {
    this.messages = [{ role: "system", content: getSystemPrompt() }];
  }

  /**
   * Add a user message to the conversation.
   */
  addUserMessage(content: string): void {
    this.messages.push({ role: "user", content });
  }

  /**
   * Add an assistant message to the conversation.
   */
  addAssistantMessage(message: ChatCompletionMessageParam): void {
    this.messages.push(message);
  }

  /**
   * Add tool results to the conversation.
   */
  addToolResults(results: ChatCompletionMessageParam[]): void {
    this.messages.push(...results);
  }

  /**
   * Get all messages for sending to the LLM.
   * Returns a copy to prevent external modification.
   */
  getMessages(): ChatCompletionMessageParam[] {
    return [...this.messages];
  }

  /**
   * Get the number of messages (excluding system prompt).
   */
  getMessageCount(): number {
    return this.messages.length - 1;
  }

  /**
   * Check if conversation needs compaction.
   */
  needsCompaction(): boolean {
    return this.messages.length > COMPACTION_THRESHOLD;
  }

  /**
   * Compact the conversation by summarizing it.
   * Replaces all messages (except system prompt) with a summary.
   */
  async compact(client: OpenAI, model: string): Promise<void> {
    if (this.messages.length <= 2) {
      return; // Nothing to compact
    }

    // Build a text representation of the conversation for summarization
    const conversationText = this.messages
      .slice(1) // Skip system prompt
      .map((msg) => {
        if (msg.role === "user") return `User: ${msg.content}`;
        if (msg.role === "assistant") {
          const content = typeof msg.content === "string" ? msg.content : "[tool calls]";
          return `Assistant: ${content}`;
        }
        if (msg.role === "tool") return `Tool result: ${String(msg.content).slice(0, 200)}...`;
        return "";
      })
      .filter(Boolean)
      .join("\n");

    // Ask LLM to summarize
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a helpful assistant that summarizes conversations." },
        { role: "user", content: `${COMPACTION_PROMPT}\n\nConversation:\n${conversationText}` },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const summary = response.choices?.[0]?.message?.content;
    if (!summary) {
      console.log("[Compaction] Failed to generate summary, keeping original messages");
      return;
    }

    // Reset and add summary as context
    const systemPrompt = this.messages[0];
    this.messages = [
      systemPrompt,
      {
        role: "user",
        content: `[CONTEXT FROM PREVIOUS WORK]\n${summary}\n\n[Continue from here]`,
      },
    ];

    console.log(`[Compaction] Reduced conversation from ${this.messages.length} to 2 messages`);
  }
}
