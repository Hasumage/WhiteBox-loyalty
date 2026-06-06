import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "cmd.exe" : "npm";

function npmRun(name, args) {
  const finalArgs = isWindows ? ["/d", "/s", "/c", "npm", ...args] : args;
  const child = spawn(npmCommand, finalArgs, {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      process.exitCode = code;
    }
  });

  child.on("error", (error) => {
    console.error(`${name} failed to start`, error);
    process.exit(1);
  });

  return child;
}

const children = [
  npmRun("web", ["run", "dev:web"]),
  npmRun("api", ["run", "api:dev"]),
  npmRun("telegram", ["run", "telegram:poll:local", "--", "--from-now"]),
];

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
