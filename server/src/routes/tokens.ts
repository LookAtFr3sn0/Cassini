import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { apiTokens } from "../db/schema.js";
import { findUserByLogin, hashToken } from "../lastfm/auth.js";

const body = {
    type: "object",
    required: ["username", "password", "kind"],
    additionalProperties: false,
    properties: {
        username: { type: "string", maxLength: 32 },
        password: { type: "string", maxLength: 256 },
        kind: { type: "string", enum: ["listenbrainz", "api"] },
        name: { type: "string", maxLength: 64 },
    },
} as const;

type TokenBody = { username: string; password: string; kind: "listenbrainz" | "api"; name?: string };

export async function tokenRoutes(app: FastifyInstance) {
    app.post<{ Body: TokenBody }>("/api/tokens", { schema: { body } }, async (request, reply) => {
        const { username, password, kind, name } = request.body;
        const user = await findUserByLogin(username, password);
        if (!user) {
            return reply.code(401).send({ error: "Invalid username or password" });
        }

        const token = randomUUID();
        await db.insert(apiTokens).values({ userId: user.id, kind, tokenHash: hashToken(token), name: name ?? null });
        return reply.code(201).send({ token });
    });
}
