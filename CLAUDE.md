# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm run build    # Compile TypeScript to dist/
npm start        # Run the CLI
npm run dev      # Build and run in one command
npm link         # Install globally as `cody` command
```

## Architecture

Cody is an AI coding agent that connects to LM Studio's local LLM via the OpenAI-compatible API.

### Core Flow

```
User Input → Agent Loop → LLM (with tools) → Tool Execution → Loop back → Final Response
```

### Key Modules

**`src/agent/loop.ts`** - The agentic loop. Sends messages + tool definitions to the LLM, executes any tool calls, feeds results back, repeats until LLM responds without tool calls. Heavily commented with numbered steps explaining the flow.

**`src/tools/`** - Tool implementations. Each tool has:
- A `definition` (JSON schema for the LLM)
- An `execute` function (actual implementation)

The registry (`index.ts`) provides `getToolDefinitions()` for the LLM and `executeTool()` for execution.

**`src/config.ts`** - LM Studio connection settings (`baseUrl`, `model`) and runtime toggles (`showThinking`).

**`src/index.ts`** - CLI entry point with readline interface. Handles `/show-thinking` command toggle.

### Local Model Handling

Local models often output reasoning in `<think>...</think>` tags (sometimes without opening tag). The `processThinkingTags()` function in `loop.ts` handles this:
- Strips thinking when `showThinking: false`
- Formats with colors when `showThinking: true` (yellow header, blue content)

Local models may also produce malformed JSON in tool arguments. `parseToolArguments()` attempts recovery.

## Adding New Tools

1. Create `src/tools/newTool.ts` following the `Tool` interface from `types.ts`
2. Import and add to the `tools` array in `src/tools/index.ts`
