import { afterEach, describe, expect, it, vi } from "vitest";
import { api, Unauthorized } from "@/api";

const respond = (status: number, body?: unknown, statusText = "") => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status, statusText })));
};

const lastCall = () => vi.mocked(fetch).mock.calls[0];

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("api", () => {
    it("sends a plain GET with no body or JSON header", async () => {
        respond(200, { ok: true });
        await api("/api/session");
        expect(lastCall()).toEqual(["/api/session", {
            method: "GET",
            headers: undefined,
            body: undefined
        }]);
    });

    it("sends a body as JSON with the matching header", async () => {
        respond(200, {});
        await api("/api/session", { method: "POST", body: { username: "a", password: "b" } });
        expect(lastCall()[1]).toEqual({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "a", password: "b" })
        });
    });

    it("sends no JSON header on a DELETE without a body", async () => {
        respond(204);
        await api("/api/session", { method: "DELETE" });
        expect(lastCall()[1]?.headers).toBeUndefined();
    });

    it("returns the parsed JSON", async () => {
        respond(200, { username: "a" });
        expect(await api("/api/session")).toEqual({ username: "a" });
    });

    it("returns nothing for 204 without reading a body", async () => {
        respond(204);
        expect(await api("/api/session", { method: "DELETE" })).toBeUndefined();
    });

    it("throws Unauthorized for 401", async () => {
        respond(401, { error: "Not authenticated" });
        await expect(api("/api/session")).rejects.toThrow(Unauthorized);
    });

    it("throws a plain error with the status on other failures", async () => {
        respond(502, { error: "down" }, "Bad Gateway");
        const error = await api("/api/v1/plays").catch((e: unknown) => e);
        expect(error).not.toBeInstanceOf(Unauthorized);
        expect(error).toEqual(new Error("502 Bad Gateway"));
    });
});
