/**
 * OpenAI Client Setup
 *
 * Creates an OpenAI client configured for the active provider.
 * The OpenAI SDK works with any OpenAI-compatible API by changing the baseURL.
 */

import OpenAI from "openai";
import { config } from "../config.js";

export const client = new OpenAI({
  baseURL: config.baseUrl,
  apiKey: config.apiKey,
});
