import mongoose from "mongoose";

/**
 * Connects to MongoDB using the URI from the environment.
 * Credentials never appear in logs — only host and database name.
 */
export async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env and configure it."
    );
  }

  mongoose.set("strictQuery", true);

  mongoose.connection.on("disconnected", () => {
    console.warn("[db] MongoDB connection lost.");
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    autoIndex: true, // builds the unique indexes defined on the schema
  });

  const { host, name } = mongoose.connection;
  console.log(`[db] Connected to MongoDB at ${host}/${name}`);
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
