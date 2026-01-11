/**
 * Spinner utility for showing loading state in terminal
 */

import ora, { type Ora } from "ora";
import { colors } from "./colors.js";

let activeSpinner: Ora | null = null;

export const spinner = {
  /**
   * Start spinner with message
   */
  start: (message: string) => {
    // Stop any existing spinner first
    if (activeSpinner) {
      activeSpinner.stop();
    }
    activeSpinner = ora({
      text: `${colors.cyan}${message}${colors.reset}`,
      spinner: "binary",
    }).start();
  },

  /**
   * Update spinner text
   */
  update: (message: string) => {
    if (activeSpinner) {
      activeSpinner.text = `${colors.cyan}${message}${colors.reset}`;
    }
  },

  /**
   * Stop spinner and clear line
   */
  stop: () => {
    if (activeSpinner) {
      activeSpinner.stop();
      activeSpinner = null;
    }
  },

  /**
   * Stop with success message
   */
  success: (message?: string) => {
    if (activeSpinner) {
      if (message) {
        activeSpinner.succeed(`${colors.green}${message}${colors.reset}`);
      } else {
        activeSpinner.stop();
      }
      activeSpinner = null;
    }
  },

  /**
   * Stop with failure message
   */
  fail: (message?: string) => {
    if (activeSpinner) {
      if (message) {
        activeSpinner.fail(`${colors.red}${message}${colors.reset}`);
      } else {
        activeSpinner.stop();
      }
      activeSpinner = null;
    }
  },
};
