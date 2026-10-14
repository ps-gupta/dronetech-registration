/**
 * OPTIONAL development convenience — run with:  npm run dev:atlas
 *
 * Starts a REAL local mongod (binary managed by mongodb-memory-server) with
 * its data files persisted under ./data/mongo, so registrations survive
 * restarts. This exists for developers who do not have MongoDB installed yet;
 * for anything serious, install MongoDB properly (see README.md) and set
 * MONGODB_URI in .env instead.
 */
import fs from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

const dbPath = new URL("../data/mongo", import.meta.url).pathname;
fs.mkdirSync(dbPath, { recursive: true });

let server;
try {
  server = await MongoMemoryServer.create({
    instance: { port: 27017, dbPath, storageEngine: "wiredTiger" },
  });
} catch {
  // Port 27017 already taken — fall back to any free port.
  server = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: "wiredTiger" },
  });
}

console.log("");
console.log("  Local development MongoDB is running (persistent, disk-backed).");
console.log(`  Add this line to your .env file:\n`);
console.log(`  MONGODB_URI=${server.getUri()}dronetech`);
console.log("\n  Keep this terminal open. Press Ctrl+C to stop.\n");

process.stdin.resume();
process.on("SIGINT", async () => {
  await server.stop();
  process.exit(0);
});
