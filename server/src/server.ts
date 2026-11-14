import Fastify from "fastify";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { config } from "./config.js";
import { db } from "./db/index.js";
import { lastfmRoutes } from "./routes/lastfm.js";

const port = Number(config.port ?? 3000);
const host = config.host || "0.0.0.0";

const app = Fastify({ logger: true });

await migrate(db, { migrationsFolder: "./drizzle" });

app.get("/health", () => ({ status: "ok" }));

try {
    await app.register(lastfmRoutes);
    await app.listen({ port, host });
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
