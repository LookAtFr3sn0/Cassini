import Fastify, { type FastifyServerOptions } from "fastify";
import { lastfmRoutes } from "./routes/lastfm.js";
import { signupRoutes } from "./routes/signup.js";

export async function buildApp(options: FastifyServerOptions = {}) {
    const app = Fastify(options);
    app.get("/health", () => ({ status: "ok" }));
    await app.register(lastfmRoutes);
    await app.register(signupRoutes);
    return app;
}
