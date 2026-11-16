import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { albums, artists, nowPlaying, scrobbles, tracks } from "../db/schema.js";
import { requireSession } from "./auth.js";
import { LastfmError, LastfmErrorCode, type Handler } from "./shared.js";

const MAX_NAME_LENGTH = 1024;
const MAX_BATCH = 50;

const field = (value: string | undefined) => ({ "#text": value ?? "", corrected: "0" });
export const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
export const tooLong = (...values: (string | undefined)[]) => values.some((value) => (value?.length ?? 0) > MAX_NAME_LENGTH);

export async function findOrCreateArtist(name: string) {
    const [row] = await db
        .insert(artists)
        .values({ name: name.trim(), nameKey: normalize(name) })
        .onConflictDoUpdate({ target: artists.nameKey, set: { nameKey: sql`excluded.name_key` } })
        .returning({ id: artists.id });
    return row!.id;
}

export async function findOrCreateTrack(artistId: number, title: string) {
    const [row] = await db
        .insert(tracks)
        .values({ artistId, title: title.trim(), titleKey: normalize(title) })
        .onConflictDoUpdate({ target: [tracks.artistId, tracks.titleKey], set: { titleKey: sql`excluded.title_key` } })
        .returning({ id: tracks.id });
    return row!.id;
}

export async function findOrCreateAlbum(artistId: number, title: string) {
    const [row] = await db
        .insert(albums)
        .values({ artistId, title: title.trim(), titleKey: normalize(title) })
        .onConflictDoUpdate({ target: [albums.artistId, albums.titleKey], set: { titleKey: sql`excluded.title_key` } })
        .returning({ id: albums.id });
    return row!.id;
}

export const updateNowPlaying: Handler = async (params) => {
    const userId = await requireSession(params);
    const { artist, track, album, albumArtist, duration } = params;
    const tooLongName = tooLong(artist) || tooLong(track) || tooLong(album) || tooLong(albumArtist);
    if (tooLongName || !artist?.trim() || !track?.trim()) {
        throw new LastfmError(LastfmErrorCode.InvalidParameters, "Missing required parameters");
    }

    const { trackId, albumId } = await resolveTrack(artist, track, album, albumArtist);

    const seconds = Number(duration);
    const isValidDuration = !Number.isNaN(seconds) && Number.isFinite(seconds) && seconds >= 0 && seconds <= 24 * 60 * 60;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + (isValidDuration ? seconds : 600) * 1000);

    const row = { trackId, albumId, startedAt, expiresAt };

    await db
        .insert(nowPlaying)
        .values({ userId, ...row })
        .onConflictDoUpdate({ target: nowPlaying.userId, set: row });

    return {
        nowplaying: {
            artist: field(artist),
            track: field(track),
            album: field(album),
            albumArtist: field(albumArtist),
            ignoredMessage: { code: "0", "#text": "" },
        },
    };
};

export async function resolveTrack(artist: string, track: string, album?: string, albumArtist?: string) {
    const artistId = await findOrCreateArtist(artist);
    const trackId = await findOrCreateTrack(artistId, track);
    const albumArtistId = albumArtist?.trim() ? await findOrCreateArtist(albumArtist) : artistId;
    const albumId = album?.trim() ? await findOrCreateAlbum(albumArtistId, album) : null;
    
    return { trackId, albumId };
}

function ignoredCode(artist: string | undefined, track: string | undefined, album: string | undefined, albumArtist: string | undefined, timestamp: number) {
    if (!artist?.trim() || tooLong(artist, albumArtist)) return 1;
    if (!track?.trim() || tooLong(track, album)) return 2;
    if (!Number.isInteger(timestamp) || timestamp <= 0) return 3;
    if (timestamp > Date.now() / 1000 + 24 * 60 * 60) return 4;
    return 0;
}

export const scrobble: Handler = async (params) => {
    const userId = await requireSession(params);
    const get = (name: string, index: number) => params[`${name}[${index}]`] ?? (index == 0 ? params[name] : undefined);

    const results = [];
    let accepted = 0;
    for (let i = 0; i < MAX_BATCH; i++) {
        const artist = get("artist", i);
        const track = get("track", i);
        if (artist === undefined && track === undefined) continue;
        const album = get("album", i);
        const albumArtist = get("albumArtist", i);
        const timestamp = Number(get("timestamp", i) || NaN);

        const code = ignoredCode(artist, track, album, albumArtist, timestamp);
        if (code === 0) {
            const { trackId, albumId } = await resolveTrack(artist!, track!, album, albumArtist);
            await db
                .insert(scrobbles)
                .values({ userId, trackId, albumId, playedAt: new Date(timestamp * 1000) })
                .onConflictDoNothing();
            accepted++;
        }
        results.push({
            artist: field(artist),
            track: field(track),
            album: field(album),
            albumArtist: field(albumArtist),
            timestamp: get("timestamp", i) ?? "",
            ignoredMessage: { code: String(code), "#text": "" },
        });
    };
    if (results.length === 0) {
        throw new LastfmError(LastfmErrorCode.InvalidParameters, "Missing required parameters");
    }

    return {
        scrobbles: {
            "@attr": { accepted, ignored: results.length - accepted },
            scrobble: results.length === 1 ? results[0] : results,
        }
    }
}
