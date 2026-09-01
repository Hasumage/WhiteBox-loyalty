import "dotenv/config";
import { Client } from "pg";

const DEFAULT_HUNT_DATABASE = "nearloy_hunt_dev";

function parseTargetDatabase() {
  const target = process.env.HUNT_DATABASE_NAME?.trim() || DEFAULT_HUNT_DATABASE;
  if (!/^[a-zA-Z0-9_]+$/.test(target)) {
    throw new Error("HUNT_DATABASE_NAME may only contain letters, numbers and underscores.");
  }
  return target;
}

function adminUrlFromDatabaseUrl(databaseName) {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set.");
  const url = new URL(raw.replace(/^postgresql:/, "postgres:"));
  url.pathname = "/postgres";
  return {
    adminConnectionString: url.toString().replace(/^postgres:/, "postgresql:"),
    targetConnectionString: raw.replace(/\/[^/?]+(\?|$)/, `/${databaseName}$1`),
  };
}

async function main() {
  const databaseName = parseTargetDatabase();
  const { adminConnectionString, targetConnectionString } = adminUrlFromDatabaseUrl(databaseName);
  const client = new Client({ connectionString: adminConnectionString });
  await client.connect();
  try {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`Created local Hunt database: ${databaseName}`);
    } else {
      console.log(`Local Hunt database already exists: ${databaseName}`);
    }
    console.log(`HUNT_DATABASE_URL=${targetConnectionString}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
