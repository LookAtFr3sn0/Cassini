import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiTokens, nowPlaying, scrobbles, users } from "../db/schema.js";
import { hashToken } from "../lastfm/auth.js";
import { resolveTrack, tooLong } from "../lastfm/track.js";

const MAX_LISTENS = 1000;

const body = {
    type: "object",
    required: ["listen_type", "payload"],
    properties: {
        listen_type: { type: "string", enum: ["single", "playing_now", "import"] },
        payload: {
            type: "array",
            minItems: 1,
            maxItems: MAX_LISTENS,
            items: {
                type: "object",
                required: ["track_metadata"],
                properties: {
                    listened_at: { type: "integer", minimum: 1 },
                    track_metadata: {
                        type: "object",
                        required: ["artist_name", "track_name"],
                        properties: {
                            artist_name: { type: "string", minLength: 1 },
                            track_name: { type: "string", minLength: 1 },
                            release_name: { type: "string" },
                        },
                    },
                },
            },
        },
    },
} as const;

type Listen = { listened_at?: number; track_metadata: { artist_name: string; track_name: string; release_name?: string } };
type SubmitBody = { listen_type: "single" | "playing_now" | "import"; payload: Listen[] };

async function findUserByToken(request: FastifyRequest) {
    const token = /^Token\s+(\S+)$/i.exec(request.headers.authorization ?? "")?.[1];
    if (!token) return undefined;

    const [user] = await db
        .select({ id: users.id, username: users.username })
        .from(apiTokens)
        .innerJoin(users, eq(users.id, apiTokens.userId))
        .where(and(eq(apiTokens.tokenHash, hashToken(token)), eq(apiTokens.kind, "listenbrainz"), isNull(apiTokens.revokedAt)));
    
    return user;
}

export async function listenbrainzRoutes(app: FastifyInstance) {
    app.get("/1/validate-token", async (request, reply) => {
        const user = await findUserByToken(request);
        return user ? { code: 200, message: "Valid token", valid: true, user_name: user.username} : { code: 200, message: "Invalid token", valid: false };
    });

    app.post<{ Body: SubmitBody }>("/1/submit-listens", { schema: { body }, bodyLimit: 10 * 1024 * 1024 }, async (request, reply) => {
        const user = await findUserByToken(request);
        if (!user) {
            return reply.code(401).send({ code: 401, error: "Invalid token" });
        }

        const { listen_type, payload } = request.body;
        const latest = Date.now() / 1000 + 24 * 60 * 60;

        for (const listen of payload) {
            const { artist_name, track_name, release_name } = listen.track_metadata;
            const blank = !artist_name.trim() || !track_name.trim();
            const badTime = listen_type !== "playing_now" && (listen.listened_at === undefined || listen.listened_at > latest);
            if (blank || badTime || tooLong(artist_name, track_name, release_name)) {
                return reply.code(400).send({ code: 400, error: "Invalid listen in payload" });
            }
        }

        for (const listen of payload) {
            const { artist_name, track_name, release_name } = listen.track_metadata;
            const { trackId, albumId } = await resolveTrack(artist_name, track_name, release_name);

            if (listen_type === "playing_now") {
                const startedAt = new Date();
                const row = { trackId, albumId, startedAt, expiresAt: new Date(startedAt.getTime() + 600 * 1000) };
                await db
                    .insert(nowPlaying)
                    .values({ userId: user.id, ...row })
                    .onConflictDoUpdate({ target: nowPlaying.userId, set: row });
            } else {
                await db
                    .insert(scrobbles)
                    .values({ userId: user.id, trackId, albumId, playedAt: new Date(listen.listened_at! * 1000) })
                    .onConflictDoNothing();
            }
        }
        return { status: "ok" };
    });
}
