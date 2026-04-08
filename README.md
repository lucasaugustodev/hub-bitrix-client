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

```bash
export HUB_BITRIX_API_KEY=your_api_key_here
export HUB_BITRIX_API_URL=https://bitrix.somosahub.us  # optional
```

## CLI Usage

### Entity Commands

Every entity supports the same set of subcommands:

| Subcommand | Description |
|---|---|
| `hub-bitrix <entity> list` | List items with filtering, sorting, pagination |
| `hub-bitrix <entity> get <id>` | Get a single item by ID |
| `hub-bitrix <entity> fields` | Show all available fields (type, required, read-only) |
| `hub-bitrix <entity> add -d '{...}'` | Create a new item |
| `hub-bitrix <entity> update <id> -d '{...}'` | Update an existing item |
| `hub-bitrix <entity> delete <id>` | Delete (goes to approval queue) |

### Supported Entities

| Entity | Bitrix Method Prefix | Default Fields |
|---|---|---|
| `deal` | `crm.deal` | ID, TITLE, STAGE_ID, OPPORTUNITY, ASSIGNED_BY_ID, DATE_CREATE |
| `contact` | `crm.contact` | ID, NAME, LAST_NAME, PHONE, EMAIL, DATE_CREATE |
| `company` | `crm.company` | ID, TITLE, PHONE, EMAIL, DATE_CREATE |
| `lead` | `crm.lead` | ID, TITLE, STATUS_ID, NAME, LAST_NAME, DATE_CREATE |
| `activity` | `crm.activity` | ID, SUBJECT, TYPE_ID, COMPLETED, RESPONSIBLE_ID, CREATED |
| `invoice` | `crm.invoice` | ID, ORDER_TOPIC, STATUS_ID, PRICE, DATE_INSERT |
| `quote` | `crm.quote` | ID, TITLE, STATUS_ID, OPPORTUNITY, DATE_CREATE |
| `product` | `crm.product` | ID, NAME, PRICE, CURRENCY_ID, ACTIVE |
| `task` | `task.item` | ID, TITLE, STATUS, RESPONSIBLE_ID, DEADLINE, CREATED_DATE |
| `user` | `user` | ID, NAME, LAST_NAME, EMAIL, ACTIVE |

### List Options

All `list` subcommands accept:

| Flag | Short | Description |
|---|---|---|
| `--filter <json>` | `-f` | JSON filter (e.g., `'{"STAGE_ID":"WON"}'`) |
| `--select <fields>` | `-s` | Comma-separated fields (e.g., `"ID,TITLE,STAGE_ID"`) |
| `--order <json>` | `-o` | JSON ordering (e.g., `'{"ID":"DESC"}'`) |
| `--limit <n>` | `-l` | Max items (default 50) |
| `--all` | `-a` | Fetch ALL pages via auto-pagination |
| `--json` | | Raw JSON output instead of table |

### Examples

```bash
# List deals, default fields
hub-bitrix deal list

# Filter won deals, order by ID desc
hub-bitrix deal list -f '{"STAGE_ID":"WON"}' -o '{"ID":"DESC"}'

# Get a specific deal
hub-bitrix deal get 42

# Show deal fields
hub-bitrix deal fields

# Create a new deal
hub-bitrix deal add -d '{"TITLE":"New deal","STAGE_ID":"NEW"}'

# Update a deal
hub-bitrix deal update 42 -d '{"STAGE_ID":"WON"}'

# Delete a deal (goes to approval)
hub-bitrix deal delete 42

# List contacts with custom select
hub-bitrix contact list -s "ID,NAME,EMAIL" -l 100

# Fetch ALL leads (auto-pagination)
hub-bitrix lead list -a

# Show product fields
hub-bitrix product fields

# List tasks for a user
hub-bitrix task list -f '{"RESPONSIBLE_ID":1}'

# Get all users as raw JSON
hub-bitrix user list --json
```

### Utility Commands

```bash
# Quick search by name/title (uses %LIKE% matching)
hub-bitrix search deal "Big Corp"
hub-bitrix search contact "John"

# Count items matching a filter
hub-bitrix count deal
hub-bitrix count lead -f '{"STATUS_ID":"NEW"}'

# List permission modules
hub-bitrix modules

# List methods in a module
hub-bitrix methods crm

# Call any Bitrix24 method directly
hub-bitrix call crm.deal.list -p '{"filter":{"STAGE_ID":"WON"},"select":["ID","TITLE"]}'

# Call with auto-pagination
hub-bitrix call-all crm.contact.list -p '{"select":["ID","NAME","EMAIL"]}'

# Check delete approval status
hub-bitrix status <approval-id>

# API health check
hub-bitrix health
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

- **Read operations** pass through directly with full audit logging
- **Write operations** (add/update) execute normally but are captured in the audit trail with before/after diffs
- **Delete operations** require admin approval — a `approval_id` is returned, poll with `hub-bitrix status <id>`
- **Module permissions** scope each API key to specific entities; use `hub-bitrix modules` to see what your key can access

## Development

```bash
git clone https://github.com/lucasaugustodev/hub-bitrix-client.git
cd hub-bitrix-client
pnpm install
pnpm build

# Test CLI
node dist/cli.js --help
```
