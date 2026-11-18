import Fastify, { type FastifyServerOptions } from "fastify";
import { config } from "./config.js";
import { lastfmRoutes } from "./routes/lastfm.js";
import { signupRoutes } from "./routes/signup.js";
import { tokenRoutes } from "./routes/tokens.js";
import { listenbrainzRoutes } from "./routes/listenbrainz.js";
import { statsRoutes } from "./routes/stats.js";
import { recommendationRoutes } from "./routes/recommendations.js";

export async function buildApp(options: FastifyServerOptions = {}) {
    const app = Fastify(options);
    app.get("/health", () => ({ status: "ok" }));
    await app.register(lastfmRoutes);
    await app.register(signupRoutes);
    await app.register(tokenRoutes);
    await app.register(listenbrainzRoutes);
    await app.register(statsRoutes);
    if (config.recommendationsEnabled) await app.register(recommendationRoutes);

    return app;
}
