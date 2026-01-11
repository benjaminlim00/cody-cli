# Todo

## P0 - Critical (Security & Stability)

- [ ] Add sandboxing so commands don't hit the host (Docker, Firejail, or VM isolation)
- [ ] Resource limits for code execution (CPU, memory, time) - Currently only time limit (30s) and output limit (1MB)
- [ ] Restrict file operations to project directory (prevent path traversal with `../`)
- [ ] Validate command whitelist for `run_command` (allowlist: npm, git, python, etc.)
- [ ] Add tool result size limits (prevent context window overflow from huge outputs)
- [ ] Add input validation to tool arguments (currently casts to string without checks)
- [ ] Approval mode for dangerous ops (confirm before delete, overwrite, rm -rf)

## P1 - High (Core Improvements)

- [ ] Add unit test suite (parseToolArguments, processThinkingTags, tools, Conversation)
- [ ] Add integration tests (mock LLM responses, tool chains, error recovery)
- [ ] Diff preview before applying changes (show unified diff, ask confirmation)
- [ ] Undo/rollback last change or last N changes
- [ ] Git-aware context (auto-read changed files, understand diffs, show status)
- [ ] Auto-run tests after code changes (verify edits didn't break things)
- [ ] Add response streaming (don't wait for full response)
- [ ] Filesystem-based tool discovery — load tool definitions on-demand
- [ ] Filter/aggregate large outputs before returning to model
- [ ] Add conversation history size limits (sliding window or summarization)
- [ ] Implement tool execution timeout wrapper for all tools (not just run_command)
- [ ] Handle empty/null assistant messages from API
- [ ] Add configuration validation at startup (missing API key, LM Studio down)

## P2 - Medium (Developer Experience)

- [x] Truncate tool args in debug logs (don't show entire file content for write_file)
- [ ] Multi-file edits in single atomic operation
- [ ] Auto-commit checkpoints before risky operations
- [ ] Auto-format after edits (run prettier/eslint fix)
- [ ] Plan mode — design approach before executing, user approval
- [ ] Long-term memory — remember project context across sessions
- [ ] Task decomposition — break complex tasks into steps automatically
- [ ] Codebase indexing — searchable index of symbols, functions, classes
- [ ] `search_tools` function with configurable detail levels
- [ ] Lazy-load tool schemas to reduce context window usage
- [ ] State persistence across executions (save progress, reusable artifacts)
- [ ] Persist command history across sessions (`.cody_history` file)
- [ ] Add `/list-tools` command to show available tools
- [ ] Add conversation export (JSON/markdown)
- [ ] Add `--version` flag
- [ ] Improve error messages with actionable context (errno, paths, fixes)
- [ ] Add structured logging with levels (ERROR, WARN, INFO, DEBUG)

## P3 - Nice to Have (Polish & Integrations)

- [ ] MCP server support — extensible tool ecosystem
- [ ] GitHub integration — create PRs, read issues, review comments
- [ ] LSP integration — go-to-definition, find references, hover docs
- [ ] Auto-context gathering — read imports, related files automatically
- [ ] Image/screenshot input for UI work
- [ ] Tab completion for file paths, commands, tool names
- [ ] Syntax highlighting in code output (beyond markdown)
- [ ] Copy code blocks to clipboard
- [ ] Automatic PII tokenization for sensitive data handling
- [ ] Allow agent to develop and save reusable skills/scripts
- [ ] Tool execution dry-run mode (`/dry-run`)
- [ ] Cache file reads in conversation context
- [ ] Add ESLint/Prettier config
- [ ] Remove `as` type assertions — use Zod or type guards
- [ ] Support `cody.config.json` in addition to `.env`
- [ ] Instrument tool execution (track usage, times, success rates)
- [ ] Add memory/token usage monitoring with warnings

## Recent Changes

- **read_file**: Now checks if path is a directory and returns helpful error instead of crashing
- **run_command**: Executes any command (30s timeout, 1MB output limit)
- **Conversation**: `getMessages()` returns a copy to prevent external modification
