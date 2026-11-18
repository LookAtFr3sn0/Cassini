import type { FastifyRequest } from "fastify";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiTokens, users } from "../db/schema.js";
import { hashToken } from "../lastfm/auth.js";

type Kind = "listenbrainz" | "api" | "web";

export const SESSION_COOKIE = "cassini_session";
export const SESSION_DAYS = 30;

async function findUserByToken(token: string, kind: Kind) {
    const fresh = kind === "web" ? gt(apiTokens.createdAt, new Date(Date.now() - SESSION_DAYS * 24 * 60 * 60 * 1000)) : undefined;
    const [user] = await db
        .select({ id: users.id, username: users.username, timezone: users.timezone })
        .from(apiTokens)
        .innerJoin(users, eq(users.id, apiTokens.userId))
        .where(and(eq(apiTokens.tokenHash, hashToken(token)), eq(apiTokens.kind, kind), isNull(apiTokens.revokedAt), fresh));
    return user;
}

export async function findUserByHeader(request: FastifyRequest, scheme: "Token" | "Bearer", kind: "listenbrainz" | "api") {
    const [name, token] = (request.headers.authorization ?? "").split(/\s+/);
    if (name?.toLowerCase() !== scheme.toLowerCase() || !token) return undefined;

    return findUserByToken(token, kind);
}

export async function findApiUser(request: FastifyRequest) {
    if (request.headers.authorization) return findUserByHeader(request, "Bearer", "api");
    const session = request.cookies?.[SESSION_COOKIE];
    return session ? findUserByToken(session, "web") : undefined;
}
