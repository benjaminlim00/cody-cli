/**
 * Configuration for Cody CLI
 *
 * These settings connect to LM Studio's OpenAI-compatible API.
 * Make sure LM Studio is running with the local server enabled.
 */

export const config = {
  // LM Studio's local server URL (default port is 1234)
  baseUrl: "http://localhost:1234/v1",

  // The model loaded in LM Studio
  // This must match exactly what LM Studio shows
  // SETUP: change this to the model you want to use
  model: "nvidia-nemotron-3-nano-30b-a3b-mlx",

  // Optional: Adjust model behavior
  temperature: 0.7,
  maxTokens: 4096,
};

/**
 * Runtime settings that can be toggled during the session.
 */
export const runtimeSettings = {
  // When true, show the model's <think>...</think> reasoning
  showThinking: true,
};
