import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: unknown; limit?: number; offset?: number};

const state = vi.hoisted(() => ({
    total: 0,
    scrobbles: [] as unknown[],
    playing: [] as unknown[],
    calls: [] as Call[],
}));

vi.mock("../db/index.js", async () => {
    const { nowPlaying, scrobbles, users } = await import("../db/schema.js");
    const answer = (call: Call) => {
        if (call.table === users) return [{ username: "testuser" }];
        if (call.table === nowPlaying)  return state.playing;
        if (call.table === scrobbles) return call.limit === undefined ? [{ total: state.total }] : state.scrobbles;
        return [];
    };
    return {
        db: {
            select: () => ({
                from: (table: unknown) => {
                    const call: Call = { table };
                    state.calls.push(call);
                    const query = {
                        innerJoin: () => query,
                        leftJoin: () => query,
                        where: () => query,
                        orderBy: () => query,
                        limit: (value: number) => { call.limit = value; return query; },
                        offset: (value: number) => { call.offset = value; return query; },
                        then: (resolve: (rows: unknown[]) => unknown) => resolve(answer(call)),
                    };
                    return query;
                },
            }),
        },
    };
});

vi.mock("./auth.js", async () => ({ requireSession: async () => "11111111-1111-4111-8111-111111111111 "}));

import { scrobbles } from "../db/schema.js";
import { clamp, getRecentTracks, toDate } from "./user.js";

type Body = { recenttracks: { "@attr": Record<string, string>; track: Record<string, unknown>[] }};

const recent = async (params: Record<string, string> = {}) => ((await getRecentTracks({ sk: "x", ...params })) as Body).recenttracks;
const pagedQuery = () => state.calls.find((call) => call.table === scrobbles && call.limit !== undefined);
const row = { playedAt: new Date(1700000000000), track: "Test Track", artist: "Test Artist", album: "Test Album" };

beforeEach(() => {
    state.total = 0;
    state.scrobbles = [];
    state.playing = [];
    state.calls.length = 0;
});

describe("toDate", () => {
    it("reads Unix seconds", () => {
        const date = toDate("1700000000");
        expect(date).toEqual(new Date(1700000000 * 1000));
        expect(toDate("0")).toEqual(new Date(0));
    });

    it.each([undefined, "", "abc", "-5", "1.5", "99999999999999999999"])("ignores $s", (value) => {
        expect(toDate(value)).toBeUndefined();
    });
});

describe("clamp", () => {
    it.each([
        [undefined, 50],
        ["abc", 50],
        ["25", 25],
        ["0", 1],
        ["500", 200],
    ])("turns $s into $i", (value, expected) => {
        expect(clamp(value, 50, 1, 200)).toEqual(expected);
    });
});

describe("getRecentTracks", () => {
    it("answers with the scrobbles and the paging info", async () => {
        state.total = 1;
        state.scrobbles = [row];
        const body = await recent();
        expect(body["@attr"]).toEqual({ user: "testuser", page: "1", perPage: "50", totalPages: "1", total: "1" });
        expect(body.track).toEqual([{
            artist: { "#text": "Test Artist", mbid: "" },
            name: "Test Track",
            streamable: "0",
            mbid: "",
            album: { "#text": "Test Album", mbid: "" },
            url: "",
            date: { "#text": "14 Nov 2023, 22:13", uts: "1700000000" },
        }]);
    });

    it("puts the playing track first", async () => {
        state.scrobbles = [row];
        state.playing = [{ track: "Playing Track", artist: "Playing Artist", album: null }];
        const body = await recent();
        expect(body.track).toHaveLength(2);
        expect(body.track[0]).toMatchObject({ "@attr": { nowplaying: "true" }, name: "Playing Track", album: { "#text": "" } });
    });

    it("leaves the playing track out after page 1", async () => {
        state.playing = [{ track: "Playing Track", artist: "Playing Artist", album: null }];
        expect((await recent({ page: "2" })).track).toHaveLength(0);
    });

    it("turns limit and page into limit and offset", async () => {
        await recent({ limit: "10", page: "3" });
        expect(pagedQuery()).toMatchObject({ limit: 10, offset: 20 });
    });

    it("stops at the page limit without asking the database", async () => {
        state.total = 1_000_000;
        state.scrobbles = [row];
        const body = await recent({ page: "5000" });
        expect(pagedQuery()).toBeUndefined();
        expect(body.track).toHaveLength(0);
        expect(body["@attr"]).toMatchObject({ totalPages: "1000", total: "1000000" });
    });
});