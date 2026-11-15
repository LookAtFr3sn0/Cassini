import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../db/index.js", () => ({ db: {} }));

import { lastfmRoutes } from "./lastfm.js";

const app = Fastify();

beforeAll(async () => {
    await app.register(lastfmRoutes);
    await app.ready();
});

afterAll(() => app.close());

const post = (payload: string, url  = "/2.0/") => app.inject({ method: "POST", url, payload, headers: { "content-type": "application/x-www-form-urlencoded" } });

describe("POST /2.0/", () => {
    it("answers in XML by default", async () => {
        const response = await post("method=none");
        expect(response.statusCode).toBe(400);
        expect(response.headers["content-type"]).toBe("text/xml; charset=utf-8");
        expect(response.body).toContain(`<lfm status="failed"><error code="3">Invalid method</error></lfm>`);
    });

    it("answers in JSON when requested", async () => {
        const response = await post("method=none&format=json");
        expect(response.json()).toEqual({ error: 3, message: "Invalid method" });
    });

    it.each(["constructor", "toString", "__proto__", ""])("rejects the method name %s", async (method) => {
        const response = await post(`method=${method}&format=json`);
        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({ error: 3 });
    });

    it("rejects a repeated parameter", async () => {
        const response = await post("method=auth.getMobileSession&username=a&username=b&format=json");
        expect(response.json()).toMatchObject({ error: 6 });
    });

    it("works without the trailing slash and with GET", async () => {
        expect((await post("method=none&format=json", "/2.0")).statusCode).toBe(400);
        const get = await app.inject({ method: "GET", url: "/2.0/?method=none&format=json" });
        expect(get.json()).toMatchObject({ error: 3 });
    });

    it("requires a session for track.updateNowPlaying", async () => {
        const response = await post("method=track.updateNowPlaying&artist=a&track=b&format=json");
        expect(response.json()).toMatchObject({ error: 9 });
    });
})