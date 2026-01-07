/**
 * Shared ANSI color codes for terminal output
 *
 * Color meanings (use consistently across codebase):
 * - red: errors, failures
 * - green: success, completion
 * - yellow: warnings, debug info
 * - blue: links, informational
 * - cyan: code, actions, status
 * - gray: de-emphasized, secondary content
 */

export const colors = {
  // Formatting (\x1b = escape character)
  reset: "\x1b[0m", // clear all formatting
  bold: "\x1b[1m", // bold text
  italic: "\x1b[3m", // italic text
  underline: "\x1b[4m", // underlined text

  // Semantic colors
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};
