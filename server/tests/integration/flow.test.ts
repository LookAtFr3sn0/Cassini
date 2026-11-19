import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { apiTokens, users } from "../../src/db/schema.js";

let container: StartedPostgreSqlContainer;
let app: FastifyInstance;
let key = "";

beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:18-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.SINGLE_USER = "false";
    process.env.RECOMMENDER_DB_PASSWORD = "test";

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
const total = async (sk = key) => Number((await call({ method: "user.getRecentTracks", sk })).recenttracks["@attr"].total);
const database = async () => (await import("../../src/db/index.js")).db;

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

        const exact = await call({ method: "user.getRecentTracks", sk: key, from: "1700000000", to: "1700000000" });
        const stored = exact.recenttracks.track.find((track: { date?: { uts: string } }) => track.date?.uts === "1700000000");
        expect(stored).toMatchObject({ name: "Test Track", artist: { "#text": "Test Artist" } });
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

    it("accepts listens through the ListenBrainz endpoint", async () => {
        const created = await app.inject({
            method: "POST",
            url: "/api/tokens",
            payload: { username: "testuser", password: "testpass", kind: "listenbrainz" },
        });
        expect(created.statusCode).toBe(201);
        const headers = { authorization: `Token ${created.json().token}` };

        const valid = await app.inject({ method: "GET", url: "/1/validate-token", headers });
        expect(valid.json()).toMatchObject({ valid: true, user_name: "testuser" });

        const submit = await app.inject({
            method: "POST",
            url: "/1/submit-listens",
            headers,
            payload: {
                listen_type: "single",
                payload: [{ listened_at: 1700000200, track_metadata: { artist_name: "Test Artist", track_name: "Another Track" } }],
            },
        });
        expect(submit.json()).toEqual({ status: "ok" });

        const recent = await call({ method: "user.getRecentTracks", sk: key });
        expect(recent.recenttracks.track[0]).toMatchObject({ name: "Another Track", date: { uts: "1700000200" } });
    });

    it("rejects ListenBrainz requests without a valid token", async () => {
        const headers = { authorization: "Token 00000000-0000-0000-0000-000000000000" };
        const valid = await app.inject({ method: "GET", url: "/1/validate-token", headers });
        expect(valid.json()).toMatchObject({ valid: false });

        const submit = await app.inject({
            method: "POST",
            url: "/1/submit-listens",
            headers,
            payload: { listen_type: "single", payload: [{ listened_at: 1700000300, track_metadata: { artist_name: "a", track_name: "b" } }] },
        });
        expect(submit.statusCode).toBe(401);
    });
});

describe("top lists", () => {
    const WINDOW = "from=1600000000&to=1600000301";
    let headers = {};

    const top = async (path: string, withHeaders: Record<string, string> = headers) => app.inject({
            method: "GET",
            url: `/api/v1/stats/top/${path}`, headers: withHeaders 
    });

    it("stores the plays and gets an API token", async () => {
        const result = await call({
            method: "track.scrobble",
            sk: key,
            "artist[0]": "Stats A", "track[0]": "X", "timestamp[0]": "1600000000",
            "artist[1]": "Stats A", "track[1]": "X", "timestamp[1]": "1600000100",
            "artist[2]": "Stats A", "track[2]": "Y", "album[2]": "Album", "timestamp[2]": "1600000200",
            "artist[3]": "Stats B", "track[3]": "Z", "timestamp[3]": "1600000300",
        });
        expect(result.scrobbles["@attr"]).toEqual({ accepted: 4, ignored: 0 });

        const created = await app.inject({
            method: "POST",
            url: "/api/tokens",
            payload: { username: "testuser", password: "testpass", kind: "api" },
        });
        headers = { authorization: `Bearer ${created.json().token}` };
    });

    it("counts plays per artist, most played first", async () => {
        const response = await top(`artists?${WINDOW}`);
        expect(response.json().items).toEqual([
            { artist: "Stats A", plays: 3 },
            { artist: "Stats B", plays: 1 },
        ]);
    });

    it("leaves out a play that is exactly at the end of the period", async () => {
        const response = await top("artists?from=1600000000&to=1600000300");
        expect(response.json().items).toEqual([{ artist: "Stats A", plays: 3 }]);
    });

    it("counts plays per track and respects the limit", async () => {
        const response = await top(`tracks?${WINDOW}&limit=1`);
        expect(response.json().items).toEqual([{ artist: "Stats A", track: "X", plays: 2 }]);
    });

    it("only lists albums for plays that had one", async () => {
        const response = await top(`albums?${WINDOW}`);
        expect(response.json().items).toEqual([{ album: "Album", artist: "Stats A", plays: 1 }]);
    });

    it.each([
        ["day", "2020-09-13"],
        ["week", "2020-09-07"],
        ["month", "2020-09-01"],
    ])("groups plays by %s", async (bucket, start) => {
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/stats/activity?${WINDOW}&bucket=${bucket}`,
            headers,
        });
        expect(response.json()).toEqual({ bucket, timezone: "UTC", items: [{ start, plays: 4 }] });
    });

    it("rejects a missing token, un unknown list, and a bad limit", async () => {
        expect((await top(`artists`, {})).statusCode).toBe(401);
        expect((await top(`genres`)).statusCode).toBe(400);
        expect((await top(`artists?limit=0`)).statusCode).toBe(400);
    });

    it("orders equal counts by name", async () => {
        const response = await top("tracks?from=1600000150&to=1600000301");
        expect(response.json().items).toEqual([
            { artist: "Stats A", track: "Y", plays: 1 },
            { artist: "Stats B", track: "Z", plays: 1 },
        ]);
    })
});

describe("tokens", () => {
    const create = (kind: string, password = "testpass") => app.inject({
        method: "POST",
        url: "/api/tokens",
        payload: { username: "testuser", password, kind },
    });
    const stats = (authorization: string) => app.inject({
        method: "GET",
        url: "/api/v1/stats/top/artists",
        headers: { authorization },
    });
    const validate = async (authorization: string) => (await app.inject({
        method: "GET",
        url: "/1/validate-token",
        headers: { authorization },
    })).json().valid;

    it("answers the health check", async () => {
        const response = await create("api", "wrongpass");
        expect((await app.inject({
            method: "GET",
            url: "/health",
        })).json()).toEqual({ status: "ok" });
    });

    it("gives no token for a wrong password", async () => {
        const response = await create("api", "wrongpass");
        expect(response.statusCode).toBe(401);
        expect(response.json().token).toBeUndefined();
    });

    it("only accepts a token on the API it was made for", async () => {
        const listenbrainz = (await create("listenbrainz")).json().token;
        const api = (await create("api")).json().token;

        expect((await stats(`Bearer ${api}`)).statusCode).toBe(200);
        expect((await stats(`Bearer ${listenbrainz}`)).statusCode).toBe(401);
        expect((await stats(`Token ${api}`)).statusCode).toBe(401);
        expect(await validate(`Token ${listenbrainz}`)).toBe(true);
        expect(await validate(`Token ${api}`)).toBe(false);
        expect(await validate(`Bearer ${listenbrainz}`)).toBe(false);
    });

    it("refuses a revoked token", async () => {
        const token = (await create("api")).json().token;
        const { hashToken } = await import("../../src/lastfm/auth.js");
        await (await database()).update(apiTokens).set({ revokedAt: new Date() }).where(eq(apiTokens.tokenHash, hashToken(token)));

        expect((await stats(`Bearer ${token}`)).statusCode).toBe(401);
    });
});

describe("web session", () => {
    it("logs in with a cookie, uses it, and logs out", async () => {
        const login = await app.inject({
            method: "POST",
            url: "/api/session",
            payload: { username: "testuser", password: "testpass" },
        });
        expect(login.statusCode).toBe(200);
        
        const cookie = login.cookies.find((c) => c.name === "cassini_session")!;
        expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/" });
        
        const cookies = { cassini_session: cookie.value };
        expect((await app.inject({
            method: "GET",
            url: "/api/session",
            cookies,
        })).json()).toMatchObject({ username: "testuser" });
        expect((await app.inject({
            method: "GET",
            url: "/api/v1/stats/top/artists",
            cookies,
        })).statusCode).toBe(200);
        
        expect((await app.inject({
            method: "DELETE",
            url: "/api/session",
            cookies,
        })).statusCode).toBe(204);
        expect((await app.inject({
            method: "GET",
            url: "/api/v1/stats/top/artists",
            cookies,
        })).statusCode).toBe(401);
    });

    it("refuses a wrong password", async () => {
        const login = await app.inject({
            method: "POST",
            url: "/api/session",
            payload: { username: "testuser", password: "wrongpass" },
        });
        expect(login.statusCode).toBe(401);
        expect(login.cookies).toEqual([]);
    });

    it("lists recent plays by newest first", async () => {
        const login = await app.inject({
            method: "POST",
            url: "/api/session",
            payload: { username: "testuser", password: "testpass" },
        });
        const cookies = { cassini_session: login.cookies.find((c) => c.name === "cassini_session")!.value };

        const first = (await app.inject({
            method: "GET",
            url: "/api/v1/plays?limit=1",
            cookies,
        })).json();
        expect(first.items).toHaveLength(1);
        expect(first.next).toBe(first.items[0].playedAt);

        const second = (await app.inject({
            method: "GET",
            url: `/api/v1/plays?limit=1&before=${first.next}`,
            cookies,
        })).json();
        expect(second.items).toHaveLength(1);
        expect(second.items[0].playedAt).toBeLessThan(first.items[0].playedAt);
        expect(second.nowPlaying).toBeNull();
        expect((await app.inject({
            method: "GET",
            url: "/api/v1/plays",
        })).statusCode).toBe(401);
    });
});

describe("ListenBrainz endpoint", () => {
    let headers = {};
    const listen = (artist_name: string, track_name: string, listened_at?: number, release_name?: string) => ({
        listened_at,
        track_metadata: { artist_name, track_name, release_name },
    });
    const submit = (listen_type: string, payload: unknown[]) => app.inject({
        method: "POST",
        url: "/1/submit-listens",
        headers,
        payload: { listen_type, payload },
    });

    it.beforeAll(async () => {
        const created = await app.inject({
            method: "POST",
            url: "/api/tokens",
            payload: { username: "testuser", password: "testpass", kind: "listenbrainz" },
        });
        headers = { authorization: `Token ${created.json().token}` };
    });

    it("shows playing_now as now playing without storing a play", async () => {
        const before = await total();
        expect((await submit("playing_now", [listen("LB Artist", "LB Now")])).json()).toEqual({ status: "ok" });
        
        const recent = await call({ method: "user.getRecentTracks", sk: key });
        expect(recent.recenttracks.track[0]).toMatchObject({ name: "LB Now", "@attr": { nowplaying: "true" } });
        expect(await total()).toBe(before);
    });

    it("stores nothing when one listen of a batch is bad", async () => {
        const before = await total();
        const response = await submit("import", [listen("LB Artist", "Good", 1650000000), listen("LB Artist", "Bad")]);
        expect(response.statusCode).toBe(400);
        expect(await total()).toBe(before);
    });

    it("stores a repeated listen once", async () => {
        const before = await total();
        await submit("single", [listen("LB Artist", "Twice", 1650000100, "LB Album")]);
        await submit("single", [listen("LB Artist", "Twice", 1650000100, "LB Album")]);
        expect(await total()).toBe(before + 1);
    });

    it.each([
        ["a single listen without a timestamp", "single", [listen("a", "b")]],
        ["a time far in the future", "single", [listen("a", "b", 9999999999)]],
        ["a blank artist", "single", [listen(" ", "b", 1650000200)]],
        ["an unknown listen type", "other", [listen("a", "b", 1650000200)]],
        ["an empty payload", "single", []],
        ["too many listens", "import", Array.from({ length: 1001 }, (_, i) => listen("a", "b", 1650000400 + i))]
    ])("rejects %s", async (_name, type, payload) => {
        expect((await submit(type, payload)).statusCode).toBe(400);
    });
});

describe("a second user", () => {
    let otherKey = "";
    let otherHeaders = {};
    const stats = async (path: string) => (await app.inject({
        method: "GET",
        url: `/api/v1/stats/${path}`,
        headers: otherHeaders,
    })).json().items;

    it("signs up, logs in and gets a token", async () => {
        const payload = { username: "otheruser", email: "otheruser@example.com", password: "otherpass" };
        expect((await app.inject({
            method: "POST",
            url: "/api/signup",
            payload,
        })).statusCode).toBe(201);

        otherKey = (await call({ method: "auth.getMobileSession", username: "otheruser", password: "otherpass" })).session.key;
        const created = await app.inject({
            method: "POST",
            url: "/api/tokens",
            payload: { username: "otheruser", password: "otherpass", kind: "api" },
        });
        otherHeaders = { authorization: `Bearer ${created.json().token}` };
    });

    it("sees nothing of the first user", async () => {
        const recent = await call({
            method: "user.getRecentTracks",
            sk: otherKey,
        });
        expect(recent.recenttracks["@attr"]).toMatchObject({ user: "otheruser", total: "0" });
        expect(recent.recenttracks.track).toEqual([]);
        expect(await stats("top/artists")).toEqual([]);
        expect(await stats("top/tracks")).toEqual([]);
        expect(await stats("top/albums")).toEqual([]);
        expect(await stats("activity")).toEqual([]);
    });

    it("can store the same play the first user already has", async () => {
        const before = await total();
        const result = await call({ method: "track.scrobble", sk: otherKey, artist: "Test Artist", track: "Test Track", albumArtist: "Various Artists", timestamp: "1700000000" });
        expect(result.scrobbles["@attr"]).toEqual({ accepted: 1, ignored: 0 });
        expect(await total(otherKey)).toBe(1);
        expect(await total()).toBe(before);
    });

    it("files an album under the album artist", async () => {
        await call({ method: "track.scrobble", sk: otherKey, artist: "Solo", track: "Song", album: "Album", albumArtist: "Various Artists", timestamp: "1600002000" });
        expect(await stats("top/albums")).toEqual([{ album: "Album", artist: "Various Artists", plays: 1 }]);
        expect(await stats("top/artists")).toEqual([
            { artist: "Solo", plays: 1 },
            { artist: "Test Artist", plays: 1 },
        ]);
    });
});

describe("activity in the user's own timezone", () => {
    it("puts a late evening UTC play on the next day in a timezone behind UTC", async () => {
        await (await database()).update(users).set({ timezone: "Europe/Paris" }).where(eq(users.username, "testuser"));
        await call({
            method: "track.scrobble",
            sk: key,
            "artist[0]": "Zone", "track[0]": "Late", "timestamp[0]": "1615149000",
            "artist[1]": "Zone", "track[1]": "Noon", "timestamp[1]": "1615159800",
        });
        const created = await app.inject({
            method: "POST",
            url: "/api/tokens",
            payload: { username: "testuser", password: "testpass", kind: "api" },
        });
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/stats/activity?from=1615140000&to=1615160000",
            headers: { authorization: `Bearer ${created.json().token}` },
        });

        expect(response.json()).toEqual({
            bucket: "day",
            timezone: "Europe/Paris",
            items: [{ start: "2021-03-07", plays: 1 }, { start: "2021-03-08", plays: 1 }],
        });
    });
})

