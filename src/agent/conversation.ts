/**
 * Conversation State Manager
 *
 * Maintains message history across multiple user interactions,
 * giving the LLM memory of previous messages in the session.
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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
