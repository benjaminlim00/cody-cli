# Boss Mode Design

Autonomous mode where Cody works continuously without user prompts, checking todos.md or improving the app.

## User Interface

**Entering boss mode:**
- User types `/boss`
- Display: `[BOSS MODE - Press ESC to exit]`
- Brief explanation: "Working autonomously on todos.md or app improvements..."

**While in boss mode:**
- No `> ` prompt (user isn't expected to type)
- Show cycle count: `[Cycle 1]`, `[Cycle 2]`, etc.
- Response still uses `◆` prefix
- Horizontal separators between cycles

**Exiting boss mode:**
- ESC key pressed
- Display: `[Boss mode ended - returning to normal]`
- Back to normal `> ` prompt

## Core Loop Behavior

**When boss mode starts:**
1. Add `bossMode: boolean` to `runtimeSettings`
2. Remove `maxIterations` cap when in boss mode

**After each cycle completes (LLM responds without tool calls):**
1. Inject a continuation prompt as a user message:
   ```
   You are in autonomous boss mode. Decide what to work on next:
   - Check todos.md for pending tasks (create it if needed)
   - Or think of improvements to make this app more useful/attractive

   Pick the most valuable action and execute it. When done, explain what you did.
   ```
2. Continue the loop

**todos.md format:**
```markdown
# Todos

- [ ] Uncompleted task
- [x] Completed task
```

The LLM reads, updates, and creates this file using existing tools.

## ESC Key Handling

1. Put stdin in raw mode when boss mode starts
2. Listen for ESC keycode (`\x1b` / ASCII 27)
3. Set `runtimeSettings.bossInterrupted = true`
4. Check this flag after each cycle before continuing
5. Restore normal readline mode on exit

## Implementation

### Files to modify

**`src/config.ts`**
- Add `bossMode: boolean` to `runtimeSettings`
- Add `bossInterrupted: boolean` to `runtimeSettings`

**`src/index.ts`**
- Add `/boss` command handler
- Add `startBossMode(conversation)` function:
  - Sets up raw stdin for ESC detection
  - Runs the boss loop with cycle counter
  - Restores readline on exit
- Add ESC key listener
- Update help text with `/boss` command

**`src/agent/loop.ts`**
- Add optional `bossMode` parameter to `runAgentLoop()` to bypass `maxIterations`

### Boss Mode Prompt

```typescript
const BOSS_CONTINUATION_PROMPT = `You are in autonomous boss mode. Decide what to work on next:
- Check todos.md for pending tasks (create it if needed)
- Or think of improvements to make this app more useful/attractive

Pick the most valuable action and execute it. When done, explain what you did.`;
```

### ESC Detection

```typescript
const ESC_KEY = '\x1b';

function setupEscListener(): void {
  process.stdin.setRawMode(true);
  process.stdin.on('data', (key) => {
    if (key.toString() === ESC_KEY) {
      runtimeSettings.bossInterrupted = true;
    }
  });
}
```
