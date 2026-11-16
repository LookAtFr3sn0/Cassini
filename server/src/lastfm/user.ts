import { and, count, desc, eq, gt, gte, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import { albums, artists, nowPlaying, scrobbles, tracks, users } from "../db/schema.js";
import { requireSession } from "./auth.js";
import type { Handler } from "./shared.js";

const MAX_TIMESTAMP = Date.UTC(3000, 0, 1) / 1000;
const MAX_PAGE = 1000;

const formatDate = (date: Date) => 
    date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
    });

const entry = (row: { artist: string; track: string; album: string | null }) => ({
    artist: { "#text": row.artist, mbid: "" },
    name: row.track,
    streamable: "0",
    mbid: "",
    album: { "#text": row.album ?? "", mbid: "" },
    url: "",
});

export const clamp = (value: string | undefined, fallback: number, min: number, max: number) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isNaN(parsed) ? fallback : Math.min(Math.max(parsed, min), max);
};

export const toDate = (value: string | undefined) => {
    const seconds = Number(value || Number.NaN);
    return Number.isInteger(seconds) && seconds >= 0 && seconds <= MAX_TIMESTAMP ? new Date(seconds * 1000) : undefined;
};

export const getRecentTracks: Handler = async (params) => {
    const userId = await requireSession(params);
    const limit = clamp(params.limit, 50, 1, 200);
    const page = clamp(params.page, 1, 1, MAX_PAGE + 1);
    const from = toDate(params.from);
    const to = toDate(params.to);
    const where = and(eq(scrobbles.userId, userId), from && gte(scrobbles.playedAt, from), to && lte(scrobbles.playedAt, to));

    const [user] = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, userId));
    const [counted] = await db
        .select({ total: count() })
        .from(scrobbles)
        .where(where);
    const total = counted?.total ?? 0;

    const rows = page > MAX_PAGE ? [] : await db
        .select({ playedAt: scrobbles.playedAt, track: tracks.title, artist: artists.name, album: albums.title })
        .from(scrobbles)
        .innerJoin(tracks, eq(tracks.id, scrobbles.trackId))
        .innerJoin(artists, eq(artists.id, tracks.artistId))
        .leftJoin(albums, eq(albums.id, scrobbles.albumId))
        .where(where)
        .orderBy(desc(scrobbles.playedAt))
        .limit(limit)
        .offset((page - 1) * limit);

    const playing = page === 1 ? await db
        .select({ track: tracks.title, artist: artists.name, album: albums.title })
        .from(nowPlaying)
        .innerJoin(tracks, eq(tracks.id, nowPlaying.trackId))
        .innerJoin(artists, eq(artists.id, tracks.artistId))
        .leftJoin(albums, eq(albums.id, nowPlaying.albumId))
        .where(and(eq(nowPlaying.userId, userId), gt(nowPlaying.expiresAt, new Date()))) : [];

    return {
        recenttracks: {
            "@attr": {
                user: user?.username ?? "",
                page: String(page),
                perPage: String(limit),
                totalPages: String(Math.min(MAX_PAGE, Math.max(1, Math.ceil(total / limit)))),
                total: String(total),
            },
            track: [
                ...playing.map((row) => ({ "@attr": { nowplaying: "true" }, ...entry(row) })),
                ...rows.map((row) => ({ ...entry(row), date: { "#text": formatDate(row.playedAt), uts: String(Math.floor(row.playedAt.getTime() / 1000)) } }))
            ],
        },
    };
};
