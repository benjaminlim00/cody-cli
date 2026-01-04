# Cody CLI

A simple AI coding agent that demonstrates how agentic coding assistants work. Connects to a local LLM running in LM Studio via its OpenAI-compatible API.

## What is an Agentic Loop?

Traditional chatbots: `User asks → LLM responds → Done`

Agentic systems: `User asks → LLM thinks → Uses tools → Observes results → Thinks again → ... → Done`

Cody keeps the LLM "in the loop" - after each tool execution, results are sent back so the LLM can decide what to do next. This continues until it has enough information to respond.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start LM Studio**
   - Load a model (default: `nvidia-nemotron-3-nano-30b-a3b-mlx`) (change in `src/config.ts`)
   - Start the local server on port 1234

3. **Configure** (optional)

   Edit `src/config.ts` to change the model or base URL.

## Usage

```bash
npm run build   # Compile TypeScript
npm start       # Run Cody
```

Or install globally:
```bash
npm link
cody            # Run from anywhere
```

## Commands

| Command | Description |
|---------|-------------|
| `/show-thinking` | Toggle display of model's chain-of-thought reasoning |
| `/new` | Clear conversation memory and start fresh |
| `exit` | Quit Cody |

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
├── config.ts          # LM Studio connection settings
├── agent/
│   ├── loop.ts        # Core agentic loop (heavily commented)
│   ├── conversation.ts # Conversation memory management
│   └── client.ts      # OpenAI client setup
└── tools/
    ├── index.ts       # Tool registry
    ├── types.ts       # Type definitions
    └── *.ts           # Individual tool implementations
```

## Example

```
You: create a hello world python script and read it back to me

>> Sending request to LLM...
>> LLM requested 1 tool call(s):
   🔧 Calling: write_file({"path":"hello.py","content":"print('Hello, World!')"})
   ✓ Result: Successfully wrote 23 characters to hello.py
>> Sending tool results back to LLM...
>> LLM requested 1 tool call(s):
   🔧 Calling: read_file({"path":"hello.py"})
   ✓ Result: print('Hello, World!')
>> Sending tool results back to LLM...
>> LLM finished (no more tool calls)

────────────────────────────────────────────────────────────
Cody: I created hello.py with a simple Hello World program. Here's the content:
print('Hello, World!')
────────────────────────────────────────────────────────────
```

## Uninstall

See [uninstall.md](./uninstall.md) for instructions on removing the global `cody` command.
