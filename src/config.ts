import dotenv from "dotenv";
import { homedir } from "os";
import { join } from "path";

// Load config files (later loads override earlier ones)
// 1. Global config: ~/.codyrc
// 2. Local config: .env in current directory
dotenv.config({ path: join(homedir(), ".codyrc") });
dotenv.config(); // loads .env from cwd

/**
 * Configuration for Cody CLI
 *
 * Supports two providers:
 * 1. OpenRouter (cloud) - Set OPENROUTER_API_KEY env var
 * 2. LM Studio (local) - Default when no API key is set
 *
 * Config is loaded from (in order of priority):
 * - Environment variables
 * - .env in current directory
 * - ~/.codyrc (global config)
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
  // Low temperature for deterministic, correct code (0.0-0.2 recommended for coding)
  // Higher values (0.5+) introduce variability that can cause syntax errors
  temperature: 0.1,
  // Room for full file outputs and multi-step tool responses
  // 4096 can truncate large generations; 8192-16384 safer for coding agents
  maxTokens: 8192,
  provider: useOpenRouter ? "openrouter" : "lmstudio",
};

/**
 * Runtime settings that can be toggled during the session.
 */
export const runtimeSettings = {
  // When true, show the model's <think>...</think> reasoning
  showThinking: true,
  // When true, show extra debug logs (API errors, request details, etc.)
  debug: false,
  // When true, agent is in autonomous boss mode
  bossMode: false,
  // Set to true when ESC is pressed to interrupt boss mode
  bossInterrupted: false,
};
