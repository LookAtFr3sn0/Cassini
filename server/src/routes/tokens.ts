import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiTokens } from "../db/schema.js";
import { findUserByLogin, hashToken } from "../lastfm/auth.js";
import { findSessionUser } from "../auth/tokens.js";

const MANAGED = ["lastfm", "listenbrainz", "api"] as const;

const body = {
    type: "object",
    required: ["kind"],
    additionalProperties: false,
    properties: {
        username: { type: "string", maxLength: 32 },
        password: { type: "string", maxLength: 256 },
        kind: { type: "string", enum: ["listenbrainz", "api"] },
        name: { type: "string", maxLength: 64 },
    },
} as const;

const params = {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
} as const;

type TokenBody = { username?: string; password?: string; kind: "listenbrainz" | "api"; name?: string };

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

export async function tokenRoutes(app: FastifyInstance) {
    app.post<{ Body: TokenBody }>("/api/tokens", { schema: { body } }, async (request, reply) => {
        const { username, password, kind, name } = request.body;
        const user = username !== undefined || password !== undefined ? await findUserByLogin(username ?? "", password ?? "") : await findSessionUser(request);
        if (!user) {
            return reply.code(401).send({ error: "Invalid username or password" });
        }

        const token = randomUUID();
        const [created] = await db
            .insert(apiTokens)
            .values({ userId: user.id, kind, tokenHash: hashToken(token), name: name || null })
            .returning({ id: apiTokens.id });
        return reply.code(201).send({ id: created!.id, token });
    });

    app.get("/api/tokens", async (request, reply) => {
        const user = await findSessionUser(request);
        if (!user) {
            return reply.code(401).send({ error: "Invalid username or password" });
        }

        const rows = await db
            .select({ id: apiTokens.id, kind: apiTokens.kind, name: apiTokens.name, createdAt: apiTokens.createdAt })
            .from(apiTokens)
            .where(and(eq(apiTokens.userId, user.id), inArray(apiTokens.kind, [...MANAGED]), isNull(apiTokens.revokedAt)))
            .orderBy(desc(apiTokens.createdAt));
        return { items: rows.map((row) => ({ ...row, createdAt: seconds(row.createdAt) })) };
    });

    app.delete<{ Params: { id: string } }>("/api/tokens/:id", { schema: { params } }, async (request, reply) => {
        const user = await findSessionUser(request);
        if (!user) {
            return reply.code(401).send({ error: "Invalid username or password" });
        }

        const revoked = await db
            .update(apiTokens)
            .set({ revokedAt: new Date() })
            .where(and(
                eq(apiTokens.id, request.params.id),
                eq(apiTokens.userId, user.id),
                inArray(apiTokens.kind, [...MANAGED]),
                isNull(apiTokens.revokedAt),
            ))
            .returning({ id: apiTokens.id });
        return revoked.length === 0 ? reply.code(404).send({ error: "Token not found" }) : reply.code(204).send();
    });
}
