import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { call, callAll, listEntities, getApprovalStatus, healthCheck } from "./api-client.js";

// ── Entity Configuration ──────────────────────────────────────────────

interface EntityConfig {
  name: string;
  description: string;
  methodPrefix: string;
  listMethod?: string;
  getMethod?: string;
  addMethod?: string;
  updateMethod?: string;
  deleteMethod?: string;
  fieldsMethod?: string;
  defaultSelect: string[];
  idParam?: string;
  searchField?: string;
  listResultKey?: string;
}

const ENTITIES: EntityConfig[] = [
  {
    name: "deal",
    description: "CRM deals",
    methodPrefix: "crm.deal",
    defaultSelect: ["ID", "TITLE", "STAGE_ID", "OPPORTUNITY", "ASSIGNED_BY_ID", "DATE_CREATE"],
    searchField: "TITLE",
  },
  {
    name: "contact",
    description: "CRM contacts",
    methodPrefix: "crm.contact",
    defaultSelect: ["ID", "NAME", "LAST_NAME", "PHONE", "EMAIL", "DATE_CREATE"],
    searchField: "NAME",
  },
  {
    name: "company",
    description: "CRM companies",
    methodPrefix: "crm.company",
    defaultSelect: ["ID", "TITLE", "PHONE", "EMAIL", "DATE_CREATE"],
    searchField: "TITLE",
  },
  {
    name: "lead",
    description: "CRM leads",
    methodPrefix: "crm.lead",
    defaultSelect: ["ID", "TITLE", "STATUS_ID", "NAME", "LAST_NAME", "DATE_CREATE"],
    searchField: "TITLE",
  },
  {
    name: "activity",
    description: "CRM activities",
    methodPrefix: "crm.activity",
    defaultSelect: ["ID", "SUBJECT", "TYPE_ID", "COMPLETED", "RESPONSIBLE_ID", "CREATED"],
    searchField: "SUBJECT",
  },
  {
    name: "invoice",
    description: "CRM invoices",
    methodPrefix: "crm.invoice",
    defaultSelect: ["ID", "ORDER_TOPIC", "STATUS_ID", "PRICE", "DATE_INSERT"],
    searchField: "ORDER_TOPIC",
  },
  {
    name: "quote",
    description: "CRM quotes",
    methodPrefix: "crm.quote",
    defaultSelect: ["ID", "TITLE", "STATUS_ID", "OPPORTUNITY", "DATE_CREATE"],
    searchField: "TITLE",
  },
  {
    name: "product",
    description: "CRM products",
    methodPrefix: "crm.product",
    defaultSelect: ["ID", "NAME", "PRICE", "CURRENCY_ID", "ACTIVE"],
    searchField: "NAME",
  },
  {
    name: "task",
    description: "Tasks",
    methodPrefix: "task.item",
    listMethod: "task.item.list",
    getMethod: "task.item.getdata",
    addMethod: "task.item.add",
    updateMethod: "task.item.update",
    deleteMethod: "task.item.delete",
    fieldsMethod: "task.item.getfields",
    defaultSelect: ["ID", "TITLE", "STATUS", "RESPONSIBLE_ID", "DEADLINE", "CREATED_DATE"],
    idParam: "taskId",
    searchField: "TITLE",
  },
  {
    name: "user",
    description: "Users",
    methodPrefix: "user",
    listMethod: "user.get",
    getMethod: "user.get",
    addMethod: "user.add",
    updateMethod: "user.update",
    fieldsMethod: "user.fields",
    defaultSelect: ["ID", "NAME", "LAST_NAME", "EMAIL", "ACTIVE"],
    searchField: "NAME",
  },
];

// ── Output Helpers ────────────────────────────────────────────────────

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "\u2026";
}

function printTable(headers: string[], rows: string[][]) {
  const table = new Table({
    head: headers.map(h => chalk.bold.cyan(h)),
    style: { head: [], border: [] },
    colWidths: headers.map(() => undefined),
  });
  rows.forEach(row => table.push(row.map(cell => truncate(cell, 60))));
  console.log(table.toString());
}

function printKeyValue(obj: Record<string, unknown>) {
  const maxKey = Math.max(...Object.keys(obj).map(k => k.length));
  for (const [key, value] of Object.entries(obj)) {
    const displayVal = value === null || value === undefined
      ? chalk.dim("null")
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
    console.log(`  ${chalk.bold(key.padEnd(maxKey))}  ${displayVal}`);
  }
}

function extractItems(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result.result)) return result.result;
  if (result.result && typeof result.result === "object" && !Array.isArray(result.result)) {
    // Some methods return { result: { tasks: [...] } } etc.
    const keys = Object.keys(result.result);
    if (keys.length === 1 && Array.isArray(result.result[keys[0]])) {
      return result.result[keys[0]];
    }
    return [result.result];
  }
  return [];
}

function printListResult(result: any, selectFields?: string[], json?: boolean) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const items = extractItems(result);
  if (items.length === 0) {
    console.log(chalk.yellow("No results found."));
    return;
  }

  const headers = selectFields && selectFields.length > 0
    ? selectFields.filter(f => f in items[0])
    : Object.keys(items[0]);

  if (headers.length === 0) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  const rows = items.map(item => headers.map(h => String(item[h] ?? "")));
  printTable(headers, rows);

  const parts: string[] = [];
  if (result.total !== undefined) parts.push(`Total: ${result.total}`);
  parts.push(`Showing: ${items.length}`);
  if (result.next !== undefined) parts.push(`Next offset: ${result.next}`);
  console.log(chalk.blue(`  ${parts.join(" | ")}`));
}

function printSingleItem(result: any, json?: boolean) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const item = result?.result ?? result;
  if (typeof item === "object" && item !== null) {
    printKeyValue(item);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

function parseJsonOpt(val: string): Record<string, unknown> {
  try {
    return JSON.parse(val);
  } catch {
    console.error(chalk.red("Invalid JSON: " + val));
    process.exit(1);
  }
}

function err(e: unknown): never {
  console.error(chalk.red(`Error: ${(e as Error).message}`));
  process.exit(1);
}

// ── Entity Command Builder ────────────────────────────────────────────

function methodFor(cfg: EntityConfig, op: "list" | "get" | "add" | "update" | "delete" | "fields"): string {
  const overrides: Record<string, string | undefined> = {
    list: cfg.listMethod,
    get: cfg.getMethod,
    add: cfg.addMethod,
    update: cfg.updateMethod,
    delete: cfg.deleteMethod,
    fields: cfg.fieldsMethod,
  };
  if (overrides[op]) return overrides[op]!;
  return `${cfg.methodPrefix}.${op}`;
}

function registerEntity(program: Command, cfg: EntityConfig) {
  const entity = program.command(cfg.name).description(`${cfg.description} shortcuts`);
  const idParam = cfg.idParam ?? "id";

  // list
  entity
    .command("list")
    .description(`List ${cfg.description} (${methodFor(cfg, "list")})`)
    .option("-f, --filter <json>", "JSON filter object", "{}")
    .option("-s, --select <fields>", "Comma-separated fields")
    .option("-o, --order <json>", "JSON order object")
    .option("-l, --limit <n>", "Max items to return", "50")
    .option("-a, --all", "Fetch ALL pages (auto-pagination)")
    .option("--json", "Raw JSON output")
    .action(async (opts) => {
      try {
        const filter = parseJsonOpt(opts.filter);
        const select = opts.select
          ? opts.select.split(",").map((s: string) => s.trim())
          : cfg.defaultSelect;
        const params: Record<string, unknown> = { filter, select };
        if (opts.order) params.order = parseJsonOpt(opts.order);
        if (!opts.all) params.start = 0;
        if (!opts.all) params.limit = parseInt(opts.limit, 10);

        const method = methodFor(cfg, "list");
        const result = opts.all
          ? await callAll(method, params)
          : await call(method, params);

        printListResult(result, select, opts.json);
      } catch (e) { err(e); }
    });

  // get
  entity
    .command("get")
    .description(`Get a single ${cfg.name} by ID (${methodFor(cfg, "get")})`)
    .argument("<id>", `${cfg.name} ID`)
    .option("--json", "Raw JSON output")
    .action(async (id: string, opts) => {
      try {
        const params: Record<string, unknown> = cfg.name === "user"
          ? { filter: { ID: id } }
          : { [idParam]: id };
        const result = await call(methodFor(cfg, "get"), params);
        printSingleItem(result, opts.json);
      } catch (e) { err(e); }
    });

  // fields
  entity
    .command("fields")
    .description(`Show available fields for ${cfg.name} (${methodFor(cfg, "fields")})`)
    .option("--json", "Raw JSON output")
    .action(async (opts) => {
      try {
        const result = await call(methodFor(cfg, "fields"));
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        const fields = result?.result ?? result;
        if (typeof fields === "object" && fields !== null) {
          const entries = Object.entries(fields);
          const headers = ["Field", "Type", "Required", "Read-Only", "Title"];
          const rows = entries.map(([key, val]: [string, any]) => [
            key,
            val?.type ?? "",
            val?.isRequired === true || val?.isRequired === "Y" ? chalk.yellow("Yes") : "",
            val?.isReadOnly === true || val?.isReadOnly === "Y" ? chalk.dim("Yes") : "",
            val?.title ?? val?.formLabel ?? val?.listLabel ?? "",
          ]);
          printTable(headers, rows);
          console.log(chalk.blue(`  Total fields: ${entries.length}`));
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (e) { err(e); }
    });

  // add
  entity
    .command("add")
    .description(`Create a new ${cfg.name} (${methodFor(cfg, "add")})`)
    .requiredOption("-d, --data <json>", "JSON data for creation")
    .option("--json", "Raw JSON output")
    .action(async (opts) => {
      try {
        const data = parseJsonOpt(opts.data);
        const params: Record<string, unknown> = cfg.name === "task"
          ? data
          : { fields: data };
        const result = await call(methodFor(cfg, "add"), params);
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          const id = result?.result;
          console.log(chalk.green(`Created ${cfg.name} with ID: ${typeof id === "object" ? JSON.stringify(id) : id}`));
        }
      } catch (e) { err(e); }
    });

  // update
  entity
    .command("update")
    .description(`Update a ${cfg.name} by ID (${methodFor(cfg, "update")})`)
    .argument("<id>", `${cfg.name} ID`)
    .requiredOption("-d, --data <json>", "JSON data for update")
    .option("--json", "Raw JSON output")
    .action(async (id: string, opts) => {
      try {
        const data = parseJsonOpt(opts.data);
        const params: Record<string, unknown> = cfg.name === "task"
          ? { [idParam]: id, ...data }
          : { [idParam]: id, fields: data };
        const result = await call(methodFor(cfg, "update"), params);
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(chalk.green(`Updated ${cfg.name} ${id} successfully.`));
        }
      } catch (e) { err(e); }
    });

  // delete (skip for user — not standard)
  if (cfg.name !== "user") {
    entity
      .command("delete")
      .description(`Delete a ${cfg.name} by ID (goes to approval queue)`)
      .argument("<id>", `${cfg.name} ID`)
      .option("--json", "Raw JSON output")
      .action(async (id: string, opts) => {
        try {
          const params: Record<string, unknown> = { [idParam]: id };
          const result = await call(methodFor(cfg, "delete"), params);
          if (opts.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            const approvalId = result?.approval_id ?? result?.result;
            console.log(chalk.yellow(`Delete request submitted for ${cfg.name} ${id}.`));
            if (approvalId) {
              console.log(chalk.yellow(`Approval ID: ${approvalId}`));
              console.log(chalk.dim(`Check status with: hub-bitrix status ${approvalId}`));
            }
          }
        } catch (e) { err(e); }
      });
  }
}

// ── Build Program ─────────────────────────────────────────────────────

const program = new Command();

program
  .name("hub-bitrix")
  .description("Bitrix24 CLI with governance, traceability, and security via Hub Bitrix")
  .version("0.2.0");

// Register all entities
for (const cfg of ENTITIES) {
  registerEntity(program, cfg);
}

// ── Utility Commands ──────────────────────────────────────────────────

// health
program
  .command("health")
  .description("Check API server health")
  .action(async () => {
    try {
      const result = await healthCheck();
      console.log(chalk.green(`API server is healthy (v${result.version ?? "unknown"})`));
      if (result.uptime) console.log(chalk.dim(`  Uptime: ${result.uptime}`));
    } catch (e) { err(e); }
  });

// modules (entities)
program
  .command("modules")
  .description("List available permission modules with method counts")
  .option("--json", "Raw JSON output")
  .action(async (opts) => {
    try {
      const result = await listEntities();
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      const items: any[] = Array.isArray(result) ? result : result.entities ?? [];
      if (items.length === 0) {
        console.log(chalk.yellow("No modules found."));
        return;
      }
      if (typeof items[0] === "string") {
        printTable(["#", "Module"], items.map((e: string, i: number) => [String(i + 1), e]));
      } else {
        const headers = Object.keys(items[0]);
        const rows = items.map((item: any) => headers.map(h => String(item[h] ?? "")));
        printTable(headers, rows);
      }
      console.log(chalk.blue(`  Total modules: ${items.length}`));
    } catch (e) { err(e); }
  });

// methods
program
  .command("methods")
  .description("List all methods in a module")
  .argument("<module>", "Module name (e.g., crm, task, user)")
  .option("--json", "Raw JSON output")
  .action(async (mod: string, opts) => {
    try {
      const result = await call("methods", { module: mod });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      const methods = result?.result ?? result;
      if (Array.isArray(methods)) {
        methods.forEach((m: string, i: number) => console.log(`  ${chalk.dim(String(i + 1).padStart(3))}  ${m}`));
        console.log(chalk.blue(`\n  Total methods: ${methods.length}`));
      } else {
        console.log(JSON.stringify(methods, null, 2));
      }
    } catch (e) { err(e); }
  });

// call
program
  .command("call")
  .description("Call any Bitrix24 method")
  .argument("<method>", "Bitrix24 method (e.g., crm.deal.list)")
  .option("-p, --params <json>", "JSON params object", "{}")
  .option("--json", "Raw JSON output (default for call)")
  .action(async (method: string, opts) => {
    try {
      const params = parseJsonOpt(opts.params);
      const result = await call(method, params);
      console.log(JSON.stringify(result, null, 2));
    } catch (e) { err(e); }
  });

// call-all
program
  .command("call-all")
  .description("Call a Bitrix24 method with auto-pagination")
  .argument("<method>", "Bitrix24 method (e.g., crm.deal.list)")
  .option("-p, --params <json>", "JSON params object", "{}")
  .action(async (method: string, opts) => {
    try {
      const params = parseJsonOpt(opts.params);
      const result = await callAll(method, params);
      console.log(JSON.stringify(result, null, 2));
    } catch (e) { err(e); }
  });

// search
program
  .command("search")
  .description("Quick search an entity by name/title")
  .argument("<entity>", "Entity name (deal, contact, company, lead, etc.)")
  .argument("<query>", "Search query (uses %LIKE% matching)")
  .option("-l, --limit <n>", "Max results", "10")
  .option("--json", "Raw JSON output")
  .action(async (entityName: string, query: string, opts) => {
    try {
      const cfg = ENTITIES.find(e => e.name === entityName);
      if (!cfg) {
        console.error(chalk.red(`Unknown entity: ${entityName}. Available: ${ENTITIES.map(e => e.name).join(", ")}`));
        process.exit(1);
      }
      const searchField = cfg.searchField ?? "TITLE";
      const filter: Record<string, string> = { [`%${searchField}`]: query };
      const params: Record<string, unknown> = {
        filter,
        select: cfg.defaultSelect,
        limit: parseInt(opts.limit, 10),
      };
      const result = await call(methodFor(cfg, "list"), params);
      printListResult(result, cfg.defaultSelect, opts.json);
    } catch (e) { err(e); }
  });

// count
program
  .command("count")
  .description("Count items matching a filter")
  .argument("<entity>", "Entity name (deal, contact, company, lead, etc.)")
  .option("-f, --filter <json>", "JSON filter object", "{}")
  .action(async (entityName: string, opts) => {
    try {
      const cfg = ENTITIES.find(e => e.name === entityName);
      if (!cfg) {
        console.error(chalk.red(`Unknown entity: ${entityName}. Available: ${ENTITIES.map(e => e.name).join(", ")}`));
        process.exit(1);
      }
      const filter = parseJsonOpt(opts.filter);
      const params: Record<string, unknown> = { filter, select: ["ID"], limit: 1 };
      const result = await call(methodFor(cfg, "list"), params);
      const total = result?.total ?? "unknown";
      console.log(chalk.green(`${cfg.description}: ${total} items`));
    } catch (e) { err(e); }
  });

// status
program
  .command("status")
  .description("Check status of a pending delete approval")
  .argument("<id>", "Approval ID")
  .option("--json", "Raw JSON output")
  .action(async (id: string, opts) => {
    try {
      const result = await getApprovalStatus(id);
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      const status = result?.status ?? result?.result?.status ?? "unknown";
      const color = status === "approved" ? chalk.green : status === "pending" ? chalk.yellow : chalk.red;
      console.log(`  Approval ${id}: ${color(status)}`);
      if (result?.result) printKeyValue(result.result);
    } catch (e) { err(e); }
  });

// ── Parse ─────────────────────────────────────────────────────────────

program.parseAsync().catch(e => {
  console.error(chalk.red((e as Error).message));
  process.exit(1);
});
