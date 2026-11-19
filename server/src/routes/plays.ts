import type { FastifyInstance } from "fastify";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import { findApiUser } from "../auth/tokens.js";
import { db } from "../db/index.js";
import { albums, artists, nowPlaying, scrobbles, tracks } from "../db/schema.js";

const MAX_TIMESTAMP = Date.UTC(3000, 0, 1) / 1000;

const queryString = {
    type: "object",
    properties: {
        before: { type: "integer", minimum: 0, maximum: MAX_TIMESTAMP },
        limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
    }
} as const;

type Route = { Querystring: { before?: number; limit: number } };

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

export async function playsRoutes(app: FastifyInstance) {
    app.get<Route>("/api/v1/plays", { schema: { querystring: queryString }}, async (request, reply) => {
        const user = await findApiUser(request);
        if (!user) {
            return reply.code(401).send({ error: "Unauthorized" });
        }

        const { before, limit } = request.query;

        const rows = await db
            .select({ playedAt: scrobbles.playedAt, track: tracks.title, artist: artists.name, album: albums.title})
            .from(scrobbles)
            .innerJoin(tracks, eq(tracks.id, scrobbles.trackId))
            .innerJoin(artists, eq(artists.id, tracks.artistId))
            .leftJoin(albums, eq(albums.id, scrobbles.albumId))
            .where(and(eq(scrobbles.userId, user.id), before === undefined ? undefined : lt(scrobbles.playedAt, new Date(before * 1000))))
            .orderBy(desc(scrobbles.playedAt))
            .limit(limit)

        const [playing] = before === undefined ? await db
            .select({ track: tracks.title, artist: artists.name, album: albums.title })
            .from(nowPlaying)
            .innerJoin(tracks, eq(tracks.id, nowPlaying.trackId))
            .innerJoin(artists, eq(artists.id, tracks.artistId))
            .leftJoin(albums, eq(albums.id, nowPlaying.albumId))
            .where(and(eq(nowPlaying.userId, user.id), gt(nowPlaying.expiresAt, new Date()))) : [];

        return {
            nowPlaying: playing ?? null,
            items: rows.map(row => ({ ...row, playedAt: seconds(row.playedAt) })),
            next: rows.length === limit ? seconds(rows.at(-1)!.playedAt) : null,
        }
    })
}
