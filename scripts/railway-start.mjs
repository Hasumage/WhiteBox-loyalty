import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const serviceName = process.env.RAILWAY_SERVICE_NAME ?? "";
const isApiService = serviceName.toLowerCase().includes("api");

const npmCommand = process.platform === "win32" ? "cmd.exe" : "npm";
const children = new Set();

if (!process.env.DAILY_REPORT_SECRET) {
  process.env.DAILY_REPORT_SECRET = `runtime-daily-report-${randomUUID()}`;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

function npmRun(name, args, env = process.env, options = {}) {
  const command = npmCommand;
  const finalArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm", ...args] : args;
  const child = spawn(command, finalArgs, {
    env,
    stdio: "inherit",
  });

  children.add(child);
  child.on("exit", (code) => {
    children.delete(child);
    if (options.exitOnClose === false) {
      if (code && code !== 0) {
        console.error(`${name} exited with code ${code}`);
      }
      return;
    }

    shutdown();
    process.exit(code ?? 1);
  });
  child.on("error", (error) => {
    console.error(`${name} failed to start`, error);
    shutdown();
    process.exit(1);
  });

  return child;
}

function npmRunOnce(name, args, env = process.env) {
  const command = npmCommand;
  const finalArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm", ...args] : args;

  return new Promise((resolve, reject) => {
    const child = spawn(command, finalArgs, {
      env,
      stdio: "inherit",
    });

    children.add(child);
    child.on("exit", (code) => {
      children.delete(child);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${name} exited with code ${code ?? 1}`));
      }
    });
    child.on("error", (error) => {
      children.delete(child);
      reject(error);
    });
  });
}

async function runMigrationsIfConfigured() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL is not set, skipping database migrations.");
    return;
  }

  console.log("Applying database migrations before service start.");
  await npmRunOnce("db:migrate", ["run", "db:migrate"]);

  if (process.env.HUNT_SEED_ON_START === "true") {
    console.log("Seeding Nearloy Hunt catalog before service start.");
    await npmRunOnce("db:seed:hunt", ["run", "db:seed:hunt"]);
  }
}

try {
  await runMigrationsIfConfigured();
} catch (error) {
  console.error("Database migration failed before service start", error);
  shutdown();
  process.exit(1);
}

if (isApiService) {
  const env = {
    ...process.env,
    API_PORT: process.env.PORT ?? process.env.API_PORT ?? "3001",
  };
  console.log(`Starting API service on port ${env.API_PORT}.`);
  npmRun("api", ["run", "api:start"], env);
} else {
  console.log(serviceName ? `Starting web service "${serviceName}".` : "Starting local Next.js app.");
  npmRun("web", ["run", "start:web"]);
  npmRun("daily-report", ["run", "reports:daily:scheduler"], process.env, { exitOnClose: false });
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
