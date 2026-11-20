import { beforeEach, describe, expect, it, vi } from "vitest";
import { scrobbles, nowPlaying } from "../db/schema.js";
import { scrobble } from "./track.js";

const state = vi.hoisted(() => ({ inserted: [] as { table: unknown; value: Record<string, unknown> }[] }));

vi.mock("../db/index.js", () => ({
    db: {
        insert: (table: unknown) => ({
            values: (value: Record<string, unknown>) => {
                state.inserted.push({ table, value });
                return {
                    onConflictDoNothing: async () => {},
                    onConflictDoUpdate: () => Object.assign(Promise.resolve(), { returning: async () => [{ id: 1 }] }),
                }
            }
        }),
    }
}));

vi.mock("./auth", () => ({ requireSession: async () => "11111111-1111-4111-8111-111111111111" }));

import { normalize, updateNowPlaying } from "./track.js";
import { LastfmErrorCode } from "./shared.js";

const saved = () => state.inserted.filter((row) => row.table === scrobbles).map((row) => row.value);
const NOW = Math.floor(Date.now() / 1000);

describe("normalize", () => {
    it.each([
        ["lowercases", "AbC", "abc"],
        ["trims", "  Radiohead  ", "radiohead"],
        ["collapses inner whitespace", "Daft \t Punk", "daft punk"],
        ["unifies unicode", "Ｂｊöｒｋ", "björk"],
        ["keeps accents", "Sigur Rós", "sigur rós"],
    ])("%s", (_name, input, expected) => {
        expect(normalize(input)).toBe(expected);
    });

    it("gives the same key for the same name written differently", () => {
        expect(normalize("AC/DC")).toBe(normalize("ac/dc"));
    });
});

describe("updateNowPlaying", () => {
    it("rejects parameters that are too long", async () => {
        await expect(updateNowPlaying({ sk: "x", artist: "a".repeat(1025), track: "b" })).rejects.toMatchObject({ code: LastfmErrorCode.InvalidParameters });
    });

    it("stores the playing track for the length of the song", async () => {
        state.inserted.length = 0;
        const result = await updateNowPlaying({ sk: "x", artist: "a", track: "b", duration: "200" });
        const row = state.inserted.find((row) => row.table === nowPlaying)!.value as { startedAt: Date; expiresAt: Date };
        expect(row.expiresAt.getTime() - row.startedAt.getTime()).toBe(200 * 1000);
        expect(result).toMatchObject({ nowplaying: { artist: { "#text": "a" }, track: { "#text": "b" }, ignoredMessage: { code: "0" } } });
    });

    it("rejects a missing track", async () => {
        await expect(updateNowPlaying({ sk: "x", artist: "a" })).rejects.toMatchObject({ code: LastfmErrorCode.InvalidParameters });
    });

    it("accepts a name of exactly 1024 characters", async () => {
        await expect(updateNowPlaying({ sk: "x", artist: "a".repeat(1024), track: "b" })).resolves.toBeDefined();
    });
});

describe("scrobble", () => {
    beforeEach(() => {
        state.inserted.length = 0;
    });

    it("stores a single scrobble without an index", async () => {
        const result = await scrobble({ sk: "x", artist: "Björk", track: "Venus as a Boy", timestamp: "1700000000" });
        expect(saved()).toEqual([expect.objectContaining({ trackId: 1, albumId: null, playedAt: new Date(1700000000 * 1000) })]);
        expect(result).toMatchObject({ scrobbles: { "@attr": { accepted: 1, ignored: 0 }, scrobble: { timestamp: "1700000000", ignoredMessage: { code: "0" } } } });
    });

    it("stores a batch and anwsers with an array", async () => {
        const result = await scrobble({
            sk: "x",
            "artist[0]": "a", "track[0]": "b", "timestamp[0]": "1700000000",
            "artist[1]": "c", "track[1]": "d", "timestamp[1]": "1700000100", "album[1]": "e",
        });
        expect(saved()).toHaveLength(2);
        expect(saved()[1]).toMatchObject({ albumId: 1 });
        const { scrobbles: body } = result as { scrobbles: { scrobble: unknown[] } };
        expect(body.scrobble).toHaveLength(2);
    });

    it.each([
        ["a missing artist", { track: "b", timestamp: "1700000000" }, "1"],
        ["a blank track", { artist: "a", track: " ", timestamp: "1700000000" }, "2"],
        ["a track that is too long", { artist: "a", track: "b".repeat(1025), timestamp: "1700000000" }, "2"],
        ["a missing timestamp", { artist: "a", track: "b" }, "3"],
        ["a timestamp that is not a number", { artist: "a", track: "b", timestamp: "abc" }, "3"],
        ["a timestamp in the future", { artist: "a", track: "b", timestamp: String(NOW + 2 * 86400)}, "4"]
    ] as [string, Record<string, string>, string][])("ignores %s", async (_name, params, code) => {
        const result = await scrobble({ sk: "x", ...params });
        expect(saved()).toHaveLength(0);
        expect(result).toMatchObject({ scrobbles: { "@attr": { accepted: 0, ignored: 1 }, scrobble: { ignoredMessage: { code } } } });
    });

    it("keeps the good entries of a mixed batch", async () => {
        const result = await scrobble({
            sk: "x",
            "artist[0]": "a", "track[0]": "b", "timestamp[0]": "1700000000",
            "artist[1]": "c", "track[1]": "d",
        });
        expect(saved()).toHaveLength(1);
        expect(result).toMatchObject({ scrobbles: { "@attr": { accepted: 1, ignored: 1 } } });
    });

    it("rejects a request with no scrobbles", async () => {
        await expect(scrobble({ sk: "x" })).rejects.toMatchObject({ code: LastfmErrorCode.InvalidParameters });
    });

    it("rejects a batch with entries past the 50 limit", async () => {
        await expect(scrobble({
            sk: "x",
            "artist[49]": "a", "track[49]": "b", "timestamp[49]": "1699999900",
            "artist[50]": "c", "track[50]": "d", "timestamp[50]": "1700000000",
        })).rejects.toMatchObject({ code: LastfmErrorCode.InvalidParameters });
        expect(saved()).toHaveLength(0);
    });
});
