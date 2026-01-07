# Cody CLI

A simple AI coding agent that demonstrates how agentic coding assistants work. Connects to LLMs via OpenAI-compatible APIs (OpenRouter or local LM Studio).

## What is an Agentic Loop?

Traditional chatbots: `User asks → LLM responds → Done`

Agentic systems: `User asks → LLM thinks → Uses tools → Observes results → Thinks again → ... → Done`

Cody keeps the LLM "in the loop" - after each tool execution, results are sent back so the LLM can decide what to do next. This continues until it has enough information to respond.

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure provider** (choose one):

   **Option A: OpenRouter (cloud)**

   ```bash
   cp .env.example .env
   # Add your OPENROUTER_API_KEY to .env
   ```

   **Option B: LM Studio (local)**

   - Load a model (default: `nvidia-nemotron-3-nano-30b-a3b-mlx`)
   - Start the local server on port 1234

3. **Configure model** (optional)

   Set `CODY_MODEL` env var or edit `src/config.ts` to change defaults.

## Usage

```bash
pnpm build      # Compile TypeScript
pnpm start      # Run Cody
```

Or install globally:

```bash
npm link        # pnpm link has issues, use npm for this
cody            # Run from anywhere
```

## Global Config

To use Cody from any directory with OpenRouter, create a global config:

```bash
cp .env ~/.codyrc
```

Config priority (highest to lowest):
1. Environment variables
2. `.env` in current directory
3. `~/.codyrc` (global)

## Commands

| Command          | Description                                          |
| ---------------- | ---------------------------------------------------- |
| `/show-thinking` | Toggle display of model's chain-of-thought reasoning |
| `/debug`         | Toggle debug mode for extra logs                     |
| `/new`           | Clear conversation memory and start fresh            |
| `exit`           | Quit Cody                                            |

## Available Tools

Cody can use these tools to help with coding tasks:

- **read_file** - Read contents of a file
- **write_file** - Create or overwrite a file
- **list_directory** - List files in a directory
- **run_command** - Execute a shell command

## Project Structure

```
src/
├── index.ts           # CLI entry point
├── config.ts          # Provider and model settings
├── agent/
│   ├── loop.ts        # Core agentic loop
│   ├── conversation.ts # Conversation memory management
│   └── client.ts      # OpenAI client setup
├── tools/
│   ├── index.ts       # Tool registry
│   ├── types.ts       # Type definitions
│   └── *.ts           # Individual tool implementations
└── utils/
    ├── colors.ts      # Shared ANSI color codes
    └── markdownRenderer.ts # Terminal markdown rendering
```

## Example

```
You: create a hello world python script and read it back to me

>> Thinking...
   🔧 write_file({"path":"hello.py","content":"print('Hello, World!')"})
   ✓ Successfully wrote 23 characters to hello.py
   🔧 read_file({"path":"hello.py"})
   ✓ print('Hello, World!')

────────────────────────────────────────────────────────────
Cody: I created hello.py with a simple Hello World program. Here's the content:
print('Hello, World!')
────────────────────────────────────────────────────────────
```

## Uninstall

See [uninstall.md](./uninstall.md) for instructions on removing the global `cody` command.
