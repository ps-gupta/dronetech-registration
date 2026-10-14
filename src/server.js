import "dotenv/config";
import { createApp } from "./app.js";
import { connectDB, disconnectDB } from "./config/db.js";

const PORT = Number(process.env.PORT || 3000);

async function main() {
  // Never start accepting traffic without a live database: the portal must
  // never pretend a record was saved when MongoDB is unavailable.
  await connectDB();

  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log("");
    console.log(`  Dronetech — Student Registration Portal`);
    console.log(`  ➜ Portal:  http://localhost:${PORT}`);
    console.log(`  ➜ Health:  http://localhost:${PORT}/api/health`);
    console.log("");
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received — shutting down gracefully.`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if connections linger.
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[startup] Failed to start:", err.message);
  console.error(
    "[startup] Is MongoDB running and MONGODB_URI correct? See README.md -> Database setup."
  );
  process.exit(1);
});
