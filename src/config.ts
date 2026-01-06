/**
 * Configuration for Cody CLI
 *
 * Supports two providers:
 * 1. OpenRouter (cloud) - Set OPENROUTER_API_KEY env var
 * 2. LM Studio (local) - Default when no API key is set
 *
 * Set CODY_MODEL env var to override the default model for either provider.
 */

const useOpenRouter = !!process.env.OPENROUTER_API_KEY;

const providers = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "xiaomi/mimo-v2-flash:free",
    apiKey: process.env.OPENROUTER_API_KEY!,
  },
  lmstudio: {
    baseUrl: "http://localhost:1234/v1",
    defaultModel: "nvidia-nemotron-3-nano-30b-a3b-mlx",
    apiKey: "lm-studio", // LM Studio doesn't need a real key
  },
};

const provider = useOpenRouter ? providers.openrouter : providers.lmstudio;

export const config = {
  baseUrl: provider.baseUrl,
  model: process.env.CODY_MODEL || provider.defaultModel,
  apiKey: provider.apiKey,
  temperature: 0.7,
  maxTokens: 4096,
  provider: useOpenRouter ? "openrouter" : "lmstudio",
};

/**
 * Runtime settings that can be toggled during the session.
 */
export const runtimeSettings = {
  // When true, show the model's <think>...</think> reasoning
  showThinking: true,
};
