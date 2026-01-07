# Uninstall Cody CLI

## Remove the global command

```bash
npm unlink -g cody-cli
```

Or manually:

```bash
# First check it's the right one (should point to this project)
ls -la "$(which cody)"

# Then remove the symlink
rm "$(which cody)"
```

## Remove global config (optional)

```bash
rm ~/.codyrc
```

## Verify removal

```bash
which cody
# Should return nothing or "cody not found"
```
