/**
 * Conversation State Manager
 *
 * Maintains message history across multiple user interactions,
 * giving the LLM memory of previous messages in the session.
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const SYSTEM_PROMPT = `You are Cody, a helpful AI coding assistant. You help users with programming tasks by reading files, writing code, running commands, and exploring directories.

When given a task:
1. Think through what steps are needed
2. Use the available tools to accomplish the task
3. Explain what you did and show relevant results

Be concise but helpful. If something fails, explain what went wrong and suggest alternatives.`;

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
    this.messages = [{ role: "system", content: SYSTEM_PROMPT }];
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
   */
  getMessages(): ChatCompletionMessageParam[] {
    return this.messages;
  }

  /**
   * Get the number of messages (excluding system prompt).
   */
  getMessageCount(): number {
    return this.messages.length - 1;
  }
}
