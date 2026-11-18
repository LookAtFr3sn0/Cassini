import type { FastifyInstance } from "fastify";
import { findApiUser } from "../auth/tokens.js";
import { DEFAULT_SOURCE, hasSource, modesOf, recommend, sources } from "../recommendations/engine.js";

const queryString = {
    type: "object",
    properties: {
        source: { type: "string", maxLength: 32, default: DEFAULT_SOURCE },
        mode: { type: "string", maxLength: 32 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
    },
} as const;

type Route = { Querystring: { source: string; mode?: string; limit: number } };

export async function recommendationRoutes(app: FastifyInstance) {
    app.get("/api/v1/recommendations/sources", async (request, reply) => {
        const user = await findApiUser(request);
        if (!user) {
            return reply.code(401).send({ error: "Unauthorized" });
        }

        const list = await Promise.all(sources().map(async (name) => ({
            name,
            modes: await modesOf(name).catch(() => [] as string[]),
        })));

        return { default: DEFAULT_SOURCE, sources: list };
    });

    app.get<Route>("/api/v1/recommendations", { schema: { querystring: queryString } }, async (request, reply) => {
        const user = await findApiUser(request);
        if (!user) {
            return reply.code(401).send({ error: "Unauthorized" });
        }

        const { source, limit } = request.query;
        if (!hasSource(source)) {
            return reply.code(400).send({ error: "Unknown source" });
        }
        if (limit < 1 || limit > 100) {
            return reply.code(400).send({ error: "Limit must be between 1 and 100" });
        }

        try {
            const modes = await modesOf(source);
            const mode = request.query.mode ?? modes[0];
            if (!mode || !modes.includes(mode)) {
                return reply.code(400).send({ error: "Unknown mode" });
            }
    
            return { source, mode, items: await recommend(source, user.id, mode, limit) };
        } catch (error) {
            request.log.error(error);
            return reply.code(502).send({ error: "Recommendation engine unavailable" });
        };
    });
}