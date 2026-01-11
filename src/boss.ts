/**
 * Boss Mode - Autonomous agent operation
 *
 * When activated, Cody works continuously without prompts,
 * checking todos.md or improving the app until ESC is pressed.
 */

export const BOSS_CONTINUATION_PROMPT = `You are in autonomous boss mode. Decide what to work on next:
- Check todos.md for pending tasks (create it if needed)
- Or think of improvements to make this app more useful/attractive

Pick the most valuable action and execute it. When done, explain what you did.`;

export const ESC_KEY = '\x1b';

export const bossMessages = {
  activated: 'Entering boss mode - working autonomously on todos.md or app improvements...\n',
  deactivated: '\n[Boss mode ended - returning to normal]\n',
  cycle: (n: number) => `\n[Cycle ${n}]`,
};
