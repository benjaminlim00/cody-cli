/**
 * OpenAI Client Setup
 *
 * Creates an OpenAI client configured to talk to LM Studio's local server.
 * The OpenAI SDK works with any OpenAI-compatible API by changing the baseURL.
 */

import OpenAI from "openai";
import { config } from "../config.js";

export const client = new OpenAI({
  baseURL: config.baseUrl,
  apiKey: "lm-studio", // LM Studio doesn't need a real key, but the SDK requires one
});
