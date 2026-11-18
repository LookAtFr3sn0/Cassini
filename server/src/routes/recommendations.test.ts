import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER = { id: '11111111-1111-4111-8111-111111111111', username: 'testuser', timezone: 'UTC' };

const state = vi.hoisted(() => ({
    user: undefined as object | undefined,
    modes: {} as Record<string, string[]>,
    down: false,
    calls: [] as unknown[][],
}));

vi.mock("../auth/tokens.js", async () => ({ findApiUser: async () => state.user }));

vi.mock("../recommendations/engine.js", async () => ({
    DEFAULT_SOURCE: "builtin",
    sources: () => Object.keys(state.modes),
    hasSource: (source: string) => Object.hasOwn(state.modes, source),
    modesOf: async (source: string) => {
        if (state.down) throw new Error("Engine down");
        return state.modes[source];
    },
    recommend: async (...args: unknown[]) => {
        state.calls.push(args);
        return [{ artist: "a", title: "b", album: null, mbid: null, score: 1, reason: "test" }];
    },
}));

import { recommendationRoutes } from "./recommendations.js";

const app = Fastify();
await app.register(recommendationRoutes);

const get = (url: string) => app.inject({ method: "GET", url });

beforeEach(() => {
    state.user = USER;
    state.modes = { builtin: ["similar", "rediscover"], other: ["test"] };
    state.down = false;
    state.calls.length = 0;
});

describe("GET /api/v1/recommendations/sources", () => {
    it("lists every engine with its modes", async () => {
        expect((await get("/api/v1/recommendations/sources")).json()).toEqual({
            default: "builtin",
            sources: [{ name: "builtin", modes: ["similar", "rediscover"] }, { name: "other", modes: ["test"] }],
        });
    });

    it("lists an engine that is down with no modes", async () => {
        state.down = true;
        const { sources } = (await get("/api/v1/recommendations/sources")).json();
        expect(sources).toEqual([{ name: "builtin", modes: [] }, { name: "other", modes: [] }]);
    });
});

describe("GET /api/v1/recommendations", () => {
    it("uses the default source and its first mode if none is specified", async () => {
        const response = await get("/api/v1/recommendations");
        expect(response.json()).toMatchObject({ source: "builtin", mode: "similar", items: [{ title: "b" }] });
        expect(state.calls).toEqual([["builtin", USER.id, "similar", 50]]);
    });

    it("passes the chosen source, mode and limit to the engine", async () => {
        await get("/api/v1/recommendations?source=other&mode=test&limit=5");
        expect(state.calls).toEqual([["other", USER.id, "test", 5]]);
    });

    it("rejects a missing token", async () => {
        state.user = undefined;
        expect((await get("/api/v1/recommendations")).statusCode).toBe(401);
    });

    it.each([
        ["an unknown source", "?source=none"],
        ["a source named like an object property", "?source=constructor"],
        ["a mode the engine doesn't have", "?mode=none"],
        ["a limit of 0", "?limit=0"],
        ["a limit of 101", "?limit=101"],
    ])("rejects %s", async (_, query) => {
            expect((await get(`/api/v1/recommendations${query}`)).statusCode).toBe(400);
            expect(state.calls).toEqual([]);
    });

    it("answers 502 when the engine is down", async () => {
        state.down = true;
        expect((await get("/api/v1/recommendations")).statusCode).toBe(502);
    });
});