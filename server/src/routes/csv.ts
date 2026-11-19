import { Readable } from "node:stream";
import type { FastifyInstance } from "fastify";
import { and, asc, eq, gt } from "drizzle-orm";
import { findApiUser } from "../auth/tokens.js";
import { cell, CsvError, parseCsv } from "../csv.js";
import { db } from "../db/index.js";
import { albums, artists, scrobbles, tracks } from "../db/schema.js";
import { normalize, resolveTrack, tooLong } from "../lastfm/track.js";

const BATCH = 5000;
const INSERT_BATCH = 1000;
const MAX_UPLOAD = 50 * 1024 * 1024;

type Play = { line: number; playedAt: Date; artist: string; track: string; album: string };

async function* lines(userId: string) {
    yield "played_at,artist,track,album\r\n";

    let lastId = 0;
    while (true) {
        const batch = await db
            .select({ id: scrobbles.id, playedAt: scrobbles.playedAt, artist: artists.name, track: tracks.title, album: albums.title })
            .from(scrobbles)
            .innerJoin(tracks, eq(tracks.id, scrobbles.trackId))
            .innerJoin(artists, eq(artists.id, tracks.artistId))
            .leftJoin(albums, eq(albums.id, scrobbles.albumId))
            .where(and(eq(scrobbles.userId, userId), gt(scrobbles.id, lastId)))
            .orderBy(asc(scrobbles.id))
            .limit(BATCH);

        const tail = batch.at(-1);
        if (!tail) return;
        lastId = tail.id;

        yield batch.map((row) => [row.playedAt.toISOString(), row.artist, row.track, row.album ?? ""].map(cell).join(",") + "\r\n").join("");
    }
}

function parseTime(value: string) {
    const seconds = /^\d+$/.test(value) ? Number(value) : Date.parse(value) / 1000;
    return Number.isFinite(seconds) ? Math.floor(seconds) : NaN;
}

function readPlays(text: string): Play[] {
    const [header, ...rows] = parseCsv(text);
    if (!header) throw new CsvError(1, "the file is empty");

    const names = header.cells.map((name) => name.trim().toLowerCase());
    const column = (name: string) => names.indexOf(name);
    const [time, artist, track, album] = ["played_at", "artist", "track", "album"].map(column) as [number, number, number, number];
    if (time < 0 || artist < 0 || track < 0) throw new CsvError(header.line, "the file must have played_at, artist, and track columns");

    const latest = Date.now() / 1000 + 24 * 60 * 60;
    return rows.map(({ line, cells }) => {
        const play = {
            line,
            artist: cells[artist]?.trim() ?? "",
            track: cells[track]?.trim() ?? "",
            album: album < 0 ? "" : cells[album]?.trim() ?? "",
        };
        const seconds = parseTime(cells[time]?.trim() ?? "");
        if (!play.artist) throw new CsvError(line, "the artist is empty");
        if (!play.track) throw new CsvError(line, "the track is empty");
        if (tooLong(play.artist, play.track, play.album)) throw new CsvError(line, "a name is too long");
        if (!(seconds > 0)) throw new CsvError(line, "played_at is not a date");
        if (seconds > latest) throw new CsvError(line, "played_at is in the future");
        return { ...play, playedAt: new Date(seconds * 1000) };
    });
}

export async function csvRoutes(app: FastifyInstance) {
    app.addContentTypeParser("text/csv", { parseAs: "string", bodyLimit: MAX_UPLOAD }, (_request, body, done) => done(null, body));

    app.get("/api/v1/export", async (request, reply) => {
        const user = await findApiUser(request);
        if (!user) {
            return reply.code(401).send({ error: "Not authenticated" });
        }

        return reply.type("text/csv; charset=utf-8").header("content-disposition", 'attachment; filename="cassini-scrobbles.csv"').send(Readable.from(lines(user.id)));
    });

    app.post<{ Body: string }>("/api/v1/import", async (request, reply) => {
        const user = await findApiUser(request);
        if (!user) {
            return reply.code(401).send({ error: "Not authenticated" });
        }
        if (typeof request.body !== "string") {
            return reply.code(415).send({ error: "The file type must be text/csv" });
        }

        let plays: Play[];
        try {
            plays = readPlays(request.body);
        } catch (err) {
            if (err instanceof CsvError) return reply.code(400).send({ error: err.message });
            throw err;
        }

        const resolved = new Map<string, Awaited<ReturnType<typeof resolveTrack>>>();
        const rows: (typeof scrobbles.$inferInsert)[] = [];
        for (const play of plays) {
            const key = [play.artist, play.track, play.album].map(normalize).join("\u0000");
            let ids = resolved.get(key);
            if (!ids) {
                ids = await resolveTrack(play.artist, play.track, play.album);
                resolved.set(key, ids);
            }
            
            rows.push({ userId: user.id, ...ids, playedAt: play.playedAt, importedFrom: "csv" });
        }

        let imported = 0;
        await db.transaction(async (tx) => {
            for (let i = 0; i < rows.length; i += INSERT_BATCH) {
                const inserted = await tx
                    .insert(scrobbles)
                    .values(rows.slice(i, i + INSERT_BATCH))
                    .onConflictDoNothing()
                    .returning({ id: scrobbles.id });
                imported += inserted.length;
            }
        });

        return { imported, duplicates: rows.length - imported };
    });
}