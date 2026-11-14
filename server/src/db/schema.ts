
import { sql } from "drizzle-orm";
import {
    bigint,
    boolean,
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
    "users",
    {
        id: uuid().primaryKey().defaultRandom(),
        username: text().notNull(),
        email: text().notNull().unique(),
        passwordHash: text().notNull(),
        timezone: text().notNull().default("UTC"),
        isAdmin: boolean().notNull().default(false),
        createdAt: createdAt(),
    },
    (t) => [uniqueIndex("users_username_lower_idx").on(sql`lower(${t.username})`)],
);

export const tokenKind = pgEnum("token_kind", ["lastfm", "listenbrainz", "api"]);

export const apiTokens = pgTable(
    "api_tokens",
    {
        id: uuid().primaryKey().defaultRandom(),
        userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
        kind: tokenKind().notNull(),
        tokenHash: text().notNull().unique(),
        name: text(),
        lastUsedAt: timestamp({ withTimezone: true }),
        revokedAt: timestamp({ withTimezone: true }),
        createdAt: createdAt(),
    },
    (t) => [index("api_tokens_user_idx").on(t.userId)]
);

export const artists = pgTable(
    "artists",
    {
        id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
        name: text().notNull(),
        nameKey: text().notNull().unique(),
        mbid: uuid().unique(),
        createdAt: createdAt(),
    },
);

export const albums = pgTable(
    "albums",
    {
        id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
        artistId: bigint({ mode: "number" }).notNull().references(() => artists.id),
        title: text().notNull(),
        titleKey: text().notNull(),
        mbid: uuid().unique(),
        createdAt: createdAt(),
    },
    (t) => [uniqueIndex("albums_artist_title_idx").on(t.artistId, t.titleKey)]
);

export const tracks = pgTable(
    "tracks",
    {
        id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
        artistId: bigint({ mode: "number" }).notNull().references(() => artists.id),
        title: text().notNull(),
        titleKey: text().notNull(),
        durationMs: integer(),
        mbid: uuid().unique(),
        createdAt: createdAt(),
    },
    (t) => [uniqueIndex("tracks_artist_title_idx").on(t.artistId, t.titleKey)],
);

export const scrobbles = pgTable(
    "scrobbles",
    {
        id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
        userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
        trackId: bigint({ mode: "number" }).notNull().references(() => tracks.id),
        albumId: bigint({ mode: "number" }).references(() => albums.id),
        playedAt: timestamp({ withTimezone: true }).notNull(),
        client: text(),
        importedFrom: text(),
        createdAt: createdAt(),
    },
    (t) => [
        uniqueIndex("scrobbles_dedupe_idx").on(t.userId, t.playedAt, t.trackId),
        index("scrobbles_user_played_idx").on(t.userId, t.playedAt),
    ]
);

export const nowPlaying = pgTable(
    "now_playing",
    {
        userId: uuid().primaryKey().references(() => users.id, { onDelete: "cascade" }),
        trackId: bigint({ mode: "number" }).notNull().references(() => tracks.id),
        albumId: bigint({ mode: "number" }).references(() => albums.id),
        startedAt: timestamp({ withTimezone: true }).notNull(),
        expiresAt: timestamp({ withTimezone: true }).notNull(),
    }
);
