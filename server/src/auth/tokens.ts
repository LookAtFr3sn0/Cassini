import type { FastifyRequest } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiTokens, users } from "../db/schema.js";
import { hashToken } from "../lastfm/auth.js";

export async function findUserByHeader(request: FastifyRequest, scheme: "Token" | "Bearer", kind: "listenbrainz" | "api") {
    const [name, token] = (request.headers.authorization ?? "").split(/\s+/);
    if (name?.toLowerCase() !== scheme.toLowerCase() || !token) return undefined;

    const [user] = await db
        .select({ id: users.id, username: users.username, timezone: users.timezone })
        .from(apiTokens)
        .innerJoin(users, eq(users.id, apiTokens.userId))
        .where(and(eq(apiTokens.tokenHash, hashToken(token)), eq(apiTokens.kind, kind), isNull(apiTokens.revokedAt)));
    return user;
}
