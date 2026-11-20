import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = { username: "testuser", timezone: "Europe/Paris" };

const api = vi.hoisted(() => vi.fn())

vi.mock("@/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/api")>()),
    api,
}));

const { Unauthorized } = await import ("@/api");

async function freshSession() {
    vi.resetModules();
    return import("@/session");
}

beforeEach(() => {
    api.mockReset();
});

describe("loadSession", () => {
    it("asks the server once and remembers the answer", async () => {
        const session = await freshSession();
        api.mockResolvedValue(USER);
        expect(await session.loadSession()).toEqual(USER);
        expect(await session.loadSession()).toEqual(USER);
        expect(api).toHaveBeenCalledOnce();
        expect(api).toHaveBeenCalledWith("/api/session");
        expect(session.user.value).toEqual(USER);
    });

    it("remembers that nobody is logged in after a 401", async () => {
        const session = await freshSession();
        api.mockRejectedValue(new Unauthorized());
        expect(await session.loadSession()).toBeNull();
        expect(await session.loadSession()).toBeNull();
        expect(api).toHaveBeenCalledOnce();
    });

    it("passes the other errors on and asks again next time", async () => {
        const session = await freshSession();
        api.mockRejectedValueOnce(new Error("502 Bad Gateway")).mockResolvedValueOnce(USER);
        await expect(session.loadSession()).rejects.toThrow("502");
        expect(await session.loadSession()).toEqual(USER);
        expect(api).toHaveBeenCalledTimes(2);
    });
});

describe("login", () => {
    it("posts the credentials, then loads the fresh user", async () => {
        const session = await freshSession();
        api.mockRejectedValueOnce(new Unauthorized())
        await session.loadSession();

        api.mockResolvedValueOnce({ username: "testuser" }).mockResolvedValueOnce(USER);
        expect(await session.login("testuser", "testpass")).toEqual(USER);
        expect(api).toHaveBeenNthCalledWith(2, "/api/session", { method: "POST", body: { username: "testuser", password: "testpass" } });
        expect(api).toHaveBeenNthCalledWith(3, "/api/session");
        expect(session.user.value).toEqual(USER);
    });

    it("leaves nobody logged in when the password is wrong", async () => {
        const session = await freshSession();
        api.mockRejectedValueOnce(new Unauthorized());
        await expect(session.login("testuser", "wrongpass")).rejects.toBeInstanceOf(Unauthorized);
        expect(session.user.value).toBeNull();
    });
});

describe("logout", () => {
    it("deletes the session and forgets the user", async () => {
        const session = await freshSession();
        api.mockResolvedValueOnce(USER);
        await session.loadSession();

        api.mockResolvedValueOnce(undefined);
        await session.logout();
        expect(session.user.value).toBeNull();
        expect(await session.loadSession()).toBeNull();
        expect(api).toHaveBeenCalledTimes(2);
    });
});
