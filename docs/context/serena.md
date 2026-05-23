# Serena

Serena is the semantic code intelligence layer for daily coding. It exposes IDE-like MCP tools for symbol lookup, reference tracking, and symbol-level edits.

## Role

Use this split:

```text
Daily coding: Serena + LeanCTX
Architecture snapshots / handoff / docs map: Graphify
Project setup and agent instructions: Sonata
```

## Install By OS

Serena is managed by `uv`.

Windows PowerShell:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
uv tool install -p 3.13 serena-agent@latest --prerelease=allow
```

macOS:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv tool install -p 3.13 serena-agent@latest --prerelease=allow
```

Linux / WSL:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv tool install -p 3.13 serena-agent@latest --prerelease=allow
```

```bash
serena init
```

## Agent Setup

### Codex

```bash
serena setup codex
```

Manual Codex MCP config shape:

```toml
[mcp_servers.serena]
startup_timeout_sec = 15
command = "serena"
args = ["start-mcp-server", "--project-from-cwd", "--context=codex"]
```

Codex app sessions may need:

```text
Activate the current dir as project using serena
```

### Claude Code

```bash
serena setup claude-code
```

Manual global setup:

```bash
claude mcp add --scope user serena -- serena start-mcp-server --context claude-code --project-from-cwd
```

Manual project setup:

```bash
claude mcp add serena -- serena start-mcp-server --context claude-code --project "$(pwd)"
```

### Claude Desktop

```json
{
  "mcpServers": {
    "serena": {
      "command": "serena",
      "args": ["start-mcp-server", "--context=claude-desktop"]
    }
  }
}
```

### Copilot CLI

Use `/mcp add`, then:

```text
name: serena
type: STDIO
command: serena start-mcp-server --context=copilot-cli --project-from-cwd
```

### Copilot In JetBrains

```json
{
  "servers": {
    "serena": {
      "type": "stdio",
      "command": "serena",
      "args": ["start-mcp-server", "--context=jb-copilot-plugin"]
    }
  }
}
```

### Pi.dev

Review the package first, then install project-local:

```bash
pi install -l npm:pi-serena-tools
```

The Pi package bridges Serena's MCP tools into native Pi tools and can auto-start a per-session Serena MCP server scoped to the current project. Pi packages can execute code and influence agent behavior, so review the package source before installing.

## Agent Rules

- Use Serena for non-trivial code navigation, symbol lookup, reference finding, and safe refactors.
- Prefer Serena over raw search when the question is about symbols, callers, declarations, implementations, or cross-file code structure.
- Use LeanCTX for compressed file reads, text search, and shell output around the Serena workflow.
- Use Graphify for durable architecture maps and handoff snapshots, not daily symbol lookup.
- Do not use Serena for tiny text-only edits, docs-only updates, exact log inspection, or when the MCP/Pi tools are unavailable.
- If Serena is unavailable, fall back to LeanCTX/native tools and mention the gap in handoff.

## Useful Serena Operations

Tool names vary by client, but the workflow is stable:

```text
activate project
read initial Serena instructions
get symbols overview
find symbol
find referencing symbols
replace symbol body
insert before/after symbol
```

## Windows Note

Serena runs through `uv`. If Windows Smart App Control blocks `uvx.exe`/`uv.exe`, use WSL or adjust Windows security policy only after reviewing the tradeoff.
