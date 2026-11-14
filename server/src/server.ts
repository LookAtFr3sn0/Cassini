import Fastify from "fastify";
import { sql } from "drizzle-orm";
import { config } from "./config";
import { db } from "./db/index";

const port = Number(config.port ?? 3000);
const host = config.host || "0.0.0.0";

const app = Fastify({ logger: true });

await db.execute(sql`select 1`);

app.get("/health", () => ({ status: "ok" }));

try {
    await app.listen({ port, host });
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
