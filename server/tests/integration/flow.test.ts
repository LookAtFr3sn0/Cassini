import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let container: StartedPostgreSqlContainer;
let app: FastifyInstance;
let key = "";

beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:18-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { db } = await import("../../src/db/index.js");
    await migrate(db, { migrationsFolder: "./drizzle" });

    const { buildApp } = await import("../../src/app.js");
    app = await buildApp();
}, 120_000);

afterAll(async () => {
    await app?.close();
    const { db } = await import("../../src/db/index.js");
    await db.$client.end();
    await container?.stop();
});

const call = async (params: Record<string, string>) => {
    const response = await app.inject({
        method: "POST",
        url: "/2.0/",
        payload: new URLSearchParams({ format: "json", ...params }).toString(),
        headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    return response.json();
};

describe("signup, login, scrobble, read back", () => {
    it("signs up and logs in", async () => {
        const signup = await app.inject({
            method: "POST",
            url: "/api/signup",
            payload: { username: "testuser", email: "testuser@example.com", password: "testpass" },
        });
        expect(signup.statusCode).toBe(201);
        
        const login = await call({
            method: "auth.getMobileSession",
            username: "TESTUSER",
            password: "testpass",
        });
        key = login.session.key;
        expect(key).toMatch(/^[0-9a-f]{32}$/);
    });

    it("stores a scrobble once, even if sent twice", async () => {
        const scrobble = { method: "track.scrobble", sk: key, artist: "Test Artist", track: "Test Track", timestamp: "1700000000" };
        expect((await call(scrobble)).scrobbles["@attr"]).toEqual({ accepted: 1, ignored: 0 });
        expect((await call(scrobble)).scrobbles["@attr"]).toEqual({ accepted: 1, ignored: 0 });

        const recent = await call({ method: "user.getRecentTracks", sk: key });
        expect(recent.recenttracks["@attr"].total).toBe("1");
    });

    it("treats the same artist written differently as the same artist", async () => {
        await call({ method: "track.scrobble", sk: key, artist: "  Test artIst ", track: "TeSt track", timestamp: "1700000100" });

        const recent = await call({ method: "user.getRecentTracks", sk: key });
        const names = recent.recenttracks.track.map((track: { artist: { "#text": string } }) => track.artist["#text"]);
        expect(names).toEqual(["Test Artist", "Test Artist"]);
    });

    it("returns the newest first and filters by time", async () => {
        const all = await call({ method: "user.getRecentTracks", sk: key });
        expect(all.recenttracks.track.map((track: { date: { uts: string } }) => track.date.uts)).toEqual(["1700000100", "1700000000"]);

        const late = await call({ method: "user.getRecentTracks", sk: key, from: "1700000050" });
        expect(late.recenttracks.track).toHaveLength(1);
        expect(late.recenttracks["@attr"].total).toBe("1");
        expect(late.recenttracks.track.map((track: { date: { uts: string } }) => track.date.uts)).toEqual(["1700000100"]);
    });
    it("rejects a wrong session key", async () => {
        expect(await call({ method: "user.getRecentTracks", sk: "0".repeat(32) })).toMatchObject({ error: 9 });
    });
});
