# hub-bitrix-client

CLI + MCP client for **Hub Bitrix** — a governance proxy for Bitrix24 with traceability, security, and delete approval workflows.

## Setup

```bash
# Install globally
npm install -g hub-bitrix-client

# Or use with npx
npx hub-bitrix-client <command>
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `HUB_BITRIX_API_KEY` | **Yes** | — | API key for authenticating with Hub Bitrix |
| `HUB_BITRIX_API_URL` | No | `https://bitrix.somosahub.us` | Hub Bitrix server URL (override for local dev) |

Set them in your shell or `.env`:

```bash
export HUB_BITRIX_API_KEY=your_api_key_here
export HUB_BITRIX_API_URL=https://bitrix.somosahub.us  # optional
```

## CLI Usage

### General

```bash
# Check API health
hub-bitrix health

# List registered entity modules
hub-bitrix entities

# Call any Bitrix24 method
hub-bitrix call <method> [--params '{}']

# Call with automatic pagination (fetches all pages)
hub-bitrix call-all <method> [--params '{}']

# Check delete approval status
hub-bitrix status <approval-id>
```

### Deal Shortcuts

```bash
# List deals
hub-bitrix deal list
hub-bitrix deal list --filter '{"STAGE_ID": "WON"}'

# Get a specific deal
hub-bitrix deal get 42
```

### Contact Shortcuts

```bash
# List contacts
hub-bitrix contact list
hub-bitrix contact list --filter '{"NAME": "John"}'

# Get a specific contact
hub-bitrix contact get 17
```

### Task Shortcuts

```bash
# List tasks
hub-bitrix task list
hub-bitrix task list --filter '{"RESPONSIBLE_ID": 1}'

# Get a specific task
hub-bitrix task get 99
```

### User Shortcuts

```bash
# List all users
hub-bitrix user list
```

### Examples with params

```bash
# List deals in a specific stage
hub-bitrix call crm.deal.list --params '{"filter": {"STAGE_ID": "WON"}, "select": ["ID", "TITLE", "OPPORTUNITY"]}'

# Get all contacts with pagination
hub-bitrix call-all crm.contact.list --params '{"select": ["ID", "NAME", "LAST_NAME", "EMAIL"]}'

# Get deal categories
hub-bitrix call crm.dealcategory.list
```

## MCP (Claude Code Integration)

Add to your Claude Code MCP config (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "hub-bitrix": {
      "command": "node",
      "args": ["/path/to/hub-bitrix-client/dist/mcp.js"],
      "env": {
        "HUB_BITRIX_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Or using npx:

```json
{
  "mcpServers": {
    "hub-bitrix": {
      "command": "npx",
      "args": ["hub-bitrix-client"],
      "env": {
        "HUB_BITRIX_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### MCP Tools

| Tool | Description | Parameters |
|---|---|---|
| `bitrix_call` | Call a single Bitrix24 method | `method: string`, `params?: object` |
| `bitrix_call_all` | Call with auto-pagination | `method: string`, `params?: object` |
| `bitrix_delete_status` | Check delete approval status | `approval_id: string` |
| `bitrix_list_entities` | List registered entity modules | — |

## Security Model

Hub Bitrix adds a governance layer on top of the Bitrix24 REST API:

### Read Operations
- All GET/list methods pass through directly with full audit logging
- Results are traced per API key and user

### Write Operations
- INSERT/UPDATE operations execute normally but are captured in the audit trail
- Before/after diffs are recorded for traceability

### Delete Operations
- DELETE requests require **admin approval** before execution
- A `approval_id` is returned immediately — poll with `hub-bitrix status <id>` or `bitrix_delete_status`
- Approvals can be reviewed and granted/denied through the Hub Bitrix admin panel

### Module Permissions
- Each API key can be scoped to specific entity modules
- The `entities` command / `bitrix_list_entities` tool shows what your key can access
- Unauthorized module access returns a 403 error

## Development

```bash
git clone https://github.com/lucasaugustodev/hub-bitrix-client.git
cd hub-bitrix-client
pnpm install
pnpm build

# Test CLI
node dist/cli.js --help
```
