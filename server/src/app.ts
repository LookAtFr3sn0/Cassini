import Fastify, { type FastifyServerOptions } from "fastify";
import { lastfmRoutes } from "./routes/lastfm.js";
import { signupRoutes } from "./routes/signup.js";
import { tokenRoutes } from "./routes/tokens.js";
import { listenbrainzRoutes } from "./routes/listenbrainz.js";

export async function buildApp(options: FastifyServerOptions = {}) {
    const app = Fastify(options);
    app.get("/health", () => ({ status: "ok" }));
    await app.register(lastfmRoutes);
    await app.register(signupRoutes);
    await app.register(tokenRoutes);
    await app.register(listenbrainzRoutes);
    return app;
}
