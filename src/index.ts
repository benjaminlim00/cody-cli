/**
 * Cody CLI - A simple AI coding agent
 *
 * This is the main entry point. We'll build this out in later phases.
 */

import { config } from "./config.js";

console.log("🤖 Cody CLI");
console.log(`Configured to connect to: ${config.baseUrl}`);
console.log(`Using model: ${config.model}`);
