import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { albums, artists, nowPlaying, tracks } from "../db/schema.js";
import { requireSession } from "./auth.js";
import { LastfmError, LastfmErrorCode, type Handler } from "./shared.js";

const MAX_NAME_LENGTH = 1024;

export const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

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
    const tooLong = [artist, track, album, albumArtist].some((value) => (value?.length ?? 0) > MAX_NAME_LENGTH);
    if (tooLong || !artist?.trim() || !track?.trim()) {
        throw new LastfmError(LastfmErrorCode.InvalidParameters, "Missing required parameters");
    }

    const artistId = await findOrCreateArtist(artist);
    const trackId = await findOrCreateTrack(artistId, track)
    const albumArtistId = albumArtist?.trim() ? await findOrCreateArtist(albumArtist) : artistId;
    const albumId = album?.trim() ? await findOrCreateAlbum(albumArtistId, album) : null;

    const seconds = Number(duration);
    const isValidDuration = !Number.isNaN(seconds) && Number.isFinite(seconds) && seconds >= 0 && seconds <= 24 * 60 * 60;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + (isValidDuration ? seconds : 600) * 1000);

    const row = { trackId, albumId, startedAt, expiresAt };

    await db
        .insert(nowPlaying)
        .values({ userId, ...row })
        .onConflictDoUpdate({ target: nowPlaying.userId, set: row });

    const field = (value: string | undefined) => ({ "#text": value ?? "", corrected: "0" });

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
