import Fastify, { type FastifyServerOptions } from "fastify";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { config } from "./config.js";
import { lastfmRoutes } from "./routes/lastfm.js";
import { signupRoutes } from "./routes/signup.js";
import { tokenRoutes } from "./routes/tokens.js";
import { listenbrainzRoutes } from "./routes/listenbrainz.js";
import { statsRoutes } from "./routes/stats.js";
import { recommendationRoutes } from "./routes/recommendations.js";
import { sessionRoutes } from "./routes/session.js";

export async function buildApp(options: FastifyServerOptions = {}) {
    const app = Fastify(options);
    await app.register(cookie);
    await app.register(sessionRoutes);
    app.get("/health", () => ({ status: "ok" }));
    await app.register(lastfmRoutes);
    await app.register(signupRoutes);
    await app.register(tokenRoutes);
    await app.register(listenbrainzRoutes);
    await app.register(statsRoutes);
    if (config.recommendationsEnabled) await app.register(recommendationRoutes);
    
    const webRoot = resolve(config.webRoot);
    if (existsSync(webRoot)) {
        await app.register(fastifyStatic, { root: webRoot, wildcard: false });
        app.setNotFoundHandler((request, reply) => {
            const isPage = request.method === "GET" && !/^\/(?:api|2\.0|1)(\/|\?|$)/.test(request.url);
            return isPage ? reply.sendFile("index.html") : reply.code(404).send({ error: "Not found" });
        });
    }

    return app;
}
