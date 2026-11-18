import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { apiTokens } from "../db/schema.js";
import { findUserByLogin, hashToken } from "../lastfm/auth.js";
import { findApiUser, SESSION_COOKIE, SESSION_DAYS } from "../auth/tokens.js";

const body = {
    type: "object",
    required: ["username", "password"],
    additionalProperties: false,
    properties: {
        username: { type: "string", maxLength: 32 },
        password: { type: "string", maxLength: 256 },
    }
} as const;

const cookieOptions = () => ({ httpOnly: true, sameSite: "strict" as const, secure: config.secureCookies, path: "/" });

const MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
const COOKIE_OPTIONS = { ...cookieOptions(), maxAge: MAX_AGE };

export async function sessionRoutes(app: FastifyInstance) {
    app.post<{ Body: { username: string, password: string } }>("/api/session", { schema: { body } }, async (request, reply) => {
        const user = await findUserByLogin(request.body.username, request.body.password);
        if (!user) {
            return reply.code(401).send({ error: "Invalid username or password" });
        }

        const token = randomUUID();
        await db.insert(apiTokens).values({
            userId: user.id,
            kind: "web",
            tokenHash: await hashToken(token),
            name: request.headers["user-agent"]?.slice(0, 64) ?? null,
        });

        return reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTIONS).send({ username: user.username });
    });
    
    app.get("/api/session", async (request, reply) => {
        const user = await findApiUser(request);
        if (!user) {
            return reply.code(401).send({ error: "Not authenticated" });
        }

        return { username: user.username, timezone: user.timezone };
    });

    app.delete("/api/session", async (request, reply) => {
        const token = request.cookies[SESSION_COOKIE];
        if (token) {
            await db
                .update(apiTokens)
                .set({ revokedAt: new Date() })
                .where(and(eq(apiTokens.tokenHash, hashToken(token)), eq(apiTokens.kind, "web")));
        }

        return reply.clearCookie(SESSION_COOKIE, cookieOptions()).code(204).send();
    });
}