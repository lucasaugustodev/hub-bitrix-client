import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { call, callAll, listEntities, getApprovalStatus } from "./api-client.js";

const server = new McpServer({
  name: "hub-bitrix-mcp",
  version: "0.1.0",
});

server.tool(
  "bitrix_call",
  "Call a single Bitrix24 REST API method. Use for any standard Bitrix24 operation (crm.deal.list, crm.contact.get, task.item.list, user.get, etc.).",
  {
    method: z.string().describe("Bitrix24 REST method name (e.g., crm.deal.list)"),
    params: z.record(z.unknown()).optional().describe("Method parameters as a JSON object"),
  },
  async (args) => {
    try {
      const result = await call(args.method, args.params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: (err as Error).message }) }] };
    }
  }
);

server.tool(
  "bitrix_call_all",
  "Call a Bitrix24 REST API method with automatic pagination, fetching all pages. Use for list methods when you need complete datasets.",
  {
    method: z.string().describe("Bitrix24 REST method name (e.g., crm.deal.list)"),
    params: z.record(z.unknown()).optional().describe("Method parameters as a JSON object"),
  },
  async (args) => {
    try {
      const result = await callAll(args.method, args.params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: (err as Error).message }) }] };
    }
  }
);

server.tool(
  "bitrix_delete_status",
  "Check the status of a pending delete approval request in Hub Bitrix.",
  {
    approval_id: z.string().describe("Approval ID returned when a delete operation requires admin approval"),
  },
  async (args) => {
    try {
      const result = await getApprovalStatus(args.approval_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: (err as Error).message }) }] };
    }
  }
);

server.tool(
  "bitrix_list_entities",
  "List all available entity modules registered in Hub Bitrix.",
  {},
  async () => {
    try {
      const result = await listEntities();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: (err as Error).message }) }] };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error("MCP server failed:", err);
  process.exit(1);
});
