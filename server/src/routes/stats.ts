import type { FastifyInstance } from "fastify";
import { and, count, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { findUserByHeader } from "../auth/tokens.js";
import { db } from "../db/index.js";
import { albums, artists, scrobbles, tracks } from "../db/schema.js";

const MAX_TIMESTAMP = Date.UTC(3000, 0, 1) / 1000;

const params = {
    type: "object",
    required: ["kind"],
    properties: { kind: { type: "string", enum: ["artists", "tracks", "albums"] } },
} as const;

const queryString = {
    type: "object",
    properties: {
        from: { type: "integer", minimum: 0, maximum: MAX_TIMESTAMP },
        to: { type: "integer", minimum: 0, maximum: MAX_TIMESTAMP },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
    },
} as const;

type Route = {
    Params: { kind: "artists" | "tracks" | "albums" };
    Querystring: { from?: number; to?: number; limit: number };
};

const top = {
    artists: (where: SQL | undefined, limit: number) => db
        .select({ artist: artists.name, plays: count() })
        .from(scrobbles)
        .innerJoin(tracks, eq(tracks.id, scrobbles.trackId))
        .innerJoin(artists, eq(artists.id, tracks.artistId))
        .where(where)
        .groupBy(artists.id)
        .orderBy(desc(count()), artists.name)
        .limit(limit),
    tracks: (where: SQL | undefined, limit: number) => db
        .select({ track: tracks.title, artist: artists.name, plays: count() })
        .from(scrobbles)
        .innerJoin(tracks, eq(tracks.id, scrobbles.trackId))
        .innerJoin(artists, eq(artists.id, tracks.artistId))
        .where(where)
        .groupBy(tracks.id, artists.id)
        .orderBy(desc(count()), tracks.title)
        .limit(limit),
    albums: (where: SQL | undefined, limit: number) => db
        .select({ album: albums.title, artist: artists.name, plays: count() })
        .from(scrobbles)
        .innerJoin(albums, eq(albums.id, scrobbles.albumId))
        .innerJoin(artists, eq(artists.id, albums.artistId))
        .where(where)
        .groupBy(albums.id, artists.id)
        .orderBy(desc(count()), albums.title)
        .limit(limit),
};

const period = (userId: string, from: number | undefined, to: number | undefined) => and(
    eq(scrobbles.userId, userId),
    from === undefined ? undefined : gte(scrobbles.playedAt,new Date(from * 1000)),
    to === undefined ? undefined : lt(scrobbles.playedAt, new Date(to * 1000))
);

const activityQuery = {
    type: "object",
    properties: {
        from: { type: "integer", minimum: 0, maximum: MAX_TIMESTAMP },
        to: { type: "integer", minimum: 0, maximum: MAX_TIMESTAMP },
        bucket: { type: "string", enum: ["day", "week", "month"], default: "day" },
    },
} as const;

type ActivityRoute = { Querystring: { from?: number; to?: number; bucket: "day" | "week" | "month" } };


export async function statsRoutes(app: FastifyInstance) {
    app.get<Route>("/api/v1/stats/top/:kind", { schema: { params, querystring: queryString } }, async (request, reply) => {
        const user = await findUserByHeader(request, "Bearer", "api");
        if (!user) {
            return reply.code(401).send({ error: "Invalid token" });
        }

        const { from, to, limit } = request.query;
        const where = period(user.id, from, to);

        return { from: from ?? null, to: to ?? null, items: await top[request.params.kind](where, limit) };
    });

    app.get<ActivityRoute>("/api/v1/stats/activity", { schema: { querystring: activityQuery }}, async (request, reply) => {
        const user = await findUserByHeader(request, "Bearer", "api");
        if (!user) {
            return reply.code(401).send({ error: "Invalid token" });
        }

        const { from, to, bucket } = request.query;
        const start = sql<string>`to_char(date_trunc(${bucket}, ${scrobbles.playedAt} at time zone ${user.timezone}), 'YYYY-MM-DD')`;

        const items = await db
            .select({ start, plays: count() })
            .from(scrobbles)
            .where(period(user.id, from, to))
            .groupBy(sql`1`)
            .orderBy(sql`1`);

        return { bucket, timezone: user.timezone, items };
    });
}
