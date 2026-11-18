import { migrate } from "drizzle-orm/node-postgres/migrator";
import { config } from "./config.js";
import { db } from "./db/index.js";
import { buildApp } from "./app.js";
import { ensureEngineLogin } from "./db/roles.js";

const port = Number(config.port ?? 3000);
const host = config.host || "0.0.0.0";

await migrate(db, { migrationsFolder: "./drizzle" });
await ensureEngineLogin(config.recommenderDBPassword);

const app = await buildApp({ logger: true });

try {
    await app.listen({ port, host });
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
