import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { call, callAll, listEntities, getApprovalStatus, healthCheck } from "./api-client.js";

function printTable(headers: string[], rows: string[][]) {
  const table = new Table({
    head: headers.map(h => chalk.bold(h)),
    style: { head: [], border: [] },
  });
  rows.forEach(row => table.push(row));
  console.log(table.toString());
}

function printList(result: any) {
  if (!result || !result.result) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const items: any[] = Array.isArray(result.result) ? result.result : [result.result];
  if (items.length === 0) {
    console.log(chalk.yellow("No results found."));
    return;
  }
  const headers = Object.keys(items[0]);
  const rows = items.map((item: any) => headers.map(h => String(item[h] ?? "")));
  printTable(headers, rows);
  if (result.total !== undefined) {
    console.log(chalk.blue(`i Total: ${result.total}`));
  }
}

const program = new Command();

program
  .name("hub-bitrix")
  .description("Bitrix24 client with governance, traceability, and security via Hub Bitrix")
  .version("0.1.0");

// health
program
  .command("health")
  .description("Check API server health")
  .action(async () => {
    try {
      const result = await healthCheck();
      console.log(chalk.green(`+ API server is healthy (v${result.version ?? "unknown"})`));
    } catch (err) {
      console.error(chalk.red(`x API server unreachable: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// entities
program
  .command("entities")
  .description("List available entity modules")
  .action(async () => {
    try {
      const result = await listEntities();
      const items: string[] = Array.isArray(result) ? result : result.entities ?? [];
      if (items.length === 0) {
        console.log("No entities found.");
        return;
      }
      printTable(["Entity"], items.map((e: string) => [e]));
    } catch (err) {
      console.error(chalk.red(`x ${(err as Error).message}`));
      process.exit(1);
    }
  });

// call
program
  .command("call")
  .description("Call a single Bitrix24 method")
  .argument("<method>", "Bitrix24 method (e.g., crm.deal.list)")
  .option("--params <json>", "JSON params object", "{}")
  .action(async (method: string, opts) => {
    try {
      const params = JSON.parse(opts.params) as Record<string, unknown>;
      const result = await call(method, params);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(chalk.red(`x ${(err as Error).message}`));
      process.exit(1);
    }
  });

// call-all
program
  .command("call-all")
  .description("Call a Bitrix24 method with auto-pagination")
  .argument("<method>", "Bitrix24 method (e.g., crm.deal.list)")
  .option("--params <json>", "JSON params object", "{}")
  .action(async (method: string, opts) => {
    try {
      const params = JSON.parse(opts.params) as Record<string, unknown>;
      const result = await callAll(method, params);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(chalk.red(`x ${(err as Error).message}`));
      process.exit(1);
    }
  });

// status
program
  .command("status")
  .description("Check status of a pending delete approval")
  .argument("<id>", "Approval ID")
  .action(async (id: string) => {
    try {
      const result = await getApprovalStatus(id);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(chalk.red(`x ${(err as Error).message}`));
      process.exit(1);
    }
  });

// deal
const deal = program.command("deal").description("CRM deal shortcuts");

deal
  .command("list")
  .description("List CRM deals (crm.deal.list)")
  .option("--filter <json>", "JSON filter object", "{}")
  .action(async (opts) => {
    try {
      const filter = JSON.parse(opts.filter) as Record<string, unknown>;
      const result = await call("crm.deal.list", { filter });
      printList(result);
    } catch (err) {
      console.error(chalk.red(`x ${(err as Error).message}`));
      process.exit(1);
    }
  });

deal
  .command("get")
  .description("Get a CRM deal by ID (crm.deal.get)")
  .argument("<id>", "Deal ID")
  .action(async (id: string) => {
    try {
      const result = await call("crm.deal.get", { id });
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(chalk.red(`x ${(err as Error).message}`));
      process.exit(1);
    }
  });

// contact
const contact = program.command("contact").description("CRM contact shortcuts");

contact
  .command("list")
  .description("List CRM contacts (crm.contact.list)")
  .option("--filter <json>", "JSON filter object", "{}")
  .action(async (opts) => {
    try {
      const filter = JSON.parse(opts.filter) as Record<string, unknown>;
      const result = await call("crm.contact.list", { filter });
      printList(result);
    } catch (err) {
      console.error(chalk.red(`x ${(err as Error).message}`));
      process.exit(1);
    }
  });

contact
  .command("get")
  .description("Get a CRM contact by ID (crm.contact.get)")
  .argument("<id>", "Contact ID")
  .action(async (id: string) => {
    try {
      const result = await call("crm.contact.get", { id });
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(chalk.red(`x ${(err as Error).message}`));
      process.exit(1);
    }
  });

// task
const task = program.command("task").description("Task shortcuts");

task
  .command("list")
  .description("List tasks (task.item.list)")
  .option("--filter <json>", "JSON filter object", "{}")
  .action(async (opts) => {
    try {
      const filter = JSON.parse(opts.filter) as Record<string, unknown>;
      const result = await call("task.item.list", { filter });
      printList(result);
    } catch (err) {
      console.error(chalk.red(`x ${(err as Error).message}`));
      process.exit(1);
    }
  });

task
  .command("get")
  .description("Get a task by ID (task.item.getdata)")
  .argument("<id>", "Task ID")
  .action(async (id: string) => {
    try {
      const result = await call("task.item.getdata", { taskId: id });
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(chalk.red(`x ${(err as Error).message}`));
      process.exit(1);
    }
  });

// user
const user = program.command("user").description("User shortcuts");

user
  .command("list")
  .description("List users (user.get)")
  .action(async () => {
    try {
      const result = await call("user.get");
      printList(result);
    } catch (err) {
      console.error(chalk.red(`x ${(err as Error).message}`));
      process.exit(1);
    }
  });

program.parseAsync().catch(err => {
  console.error(err.message);
  process.exit(1);
});
