# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
pnpm build       # Compile TypeScript to dist/
pnpm start       # Run the CLI
pnpm dev         # Build and run in one command
npm link         # Install globally as `cody` command (pnpm link has issues)
```

## Configuration

Config is loaded from (in priority order):
1. Environment variables
2. `.env` in current directory
3. `~/.codyrc` (global config)

Key env vars:
- `OPENROUTER_API_KEY` - Use OpenRouter instead of local LM Studio
- `CODY_MODEL` - Override the default model

## Architecture

Cody is an AI coding agent that connects to LLMs via OpenAI-compatible APIs (OpenRouter or local LM Studio).

### Core Flow

```
User Input → Agent Loop → LLM (with tools) → Tool Execution → Loop back → Final Response
```

### Key Modules

**`src/config.ts`** - Provider settings (OpenRouter/LM Studio), model selection, and runtime toggles. Loads from env vars, `.env`, and `~/.codyrc`.

**`src/agent/loop.ts`** - The agentic loop. Sends messages + tool definitions to the LLM, executes any tool calls, feeds results back, repeats until LLM responds without tool calls.

**`src/agent/client.ts`** - OpenAI client setup, configured for the active provider.

**`src/index.ts`** - CLI entry point with readline interface. Handles `/show-thinking`, `/debug`, `/new`, and `/boss` commands. Supports `--boss` flag for startup.

**`src/boss.ts`** - Boss mode constants and messages for autonomous operation.

**`src/tools/`** - Tool implementations. Each tool has a `definition` (JSON schema) and an `execute` function.

**`src/utils/`** - Shared utilities:
- `colors.ts` - ANSI color codes (single source of truth)
- `markdownRenderer.ts` - Terminal markdown rendering

### Local Model Handling

Local models often output reasoning in `<think>...</think>` tags. The `processThinkingTags()` function in `loop.ts` handles this:
- Strips thinking when `showThinking: false`
- Formats with colors when `showThinking: true`

Local models may also produce malformed JSON in tool arguments. `parseToolArguments()` attempts recovery.

## Boss Mode

Autonomous mode where Cody works continuously without user prompts:
- Start with `cody --boss` or type `/boss` during a session
- Press ESC to exit and return to normal mode
- Cody checks `todos.md` for tasks or thinks of app improvements
- No iteration cap in boss mode (outer loop handles continuation)

## Adding New Tools

1. Create `src/tools/newTool.ts` following the `Tool` interface from `types.ts`
2. Import and add to the `tools` array in `src/tools/index.ts`
