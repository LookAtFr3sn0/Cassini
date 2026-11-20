import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as object | null }));

vi.mock("@/session", () => ({ loadSession: async () => state.user }));

async function freshRouter() {
    vi.resetModules();
    return (await import("@/router")).default;
}

beforeEach(() => {
    state.user = null;
});

describe("router", () => {
    it("sends a logged out visitor to login, remembering where they were going", async () => {
        const router = await freshRouter();
        await router.push("/top/tracks");
        expect(router.currentRoute.value.name).toBe("login");
        expect(router.currentRoute.value.query.next).toBe("/top/tracks");
    });

    it("lets a logged out visitor see the login page", async () => {
        const router = await freshRouter();
        await router.push("/login");
        expect(router.currentRoute.value.name).toBe("login");
        expect(router.currentRoute.value.query.next).toBeUndefined();
    });

    it("lets a logged in user through", async () => {
        state.user = { username: "testuser", timezone: "Europe/Paris" };
        const router = await freshRouter();
        await router.push("/top/albums");
        expect(router.currentRoute.value.name).toBe("top");
        expect(router.currentRoute.value.params.kind).toBe("albums");
    });

    it("sends a logged in user away from the login page", async () => {
        state.user = { username: "testuser", timezone: "Europe/Paris" };
        const router = await freshRouter();
        await router.push("/login");
        expect(router.currentRoute.value.name).toBe("recent");
    });

    it.each([
        ["/top", "/top/artists"],
        ["/top/songs", "/"],
        ["/something", "/"],
    ])("redirects %s to %s", async (from, to) => {
        state.user = { username: "testuser", timezone: "Europe/Paris" };
        const router = await freshRouter();
        await router.push(from);
        expect(router.currentRoute.value.path).toBe(to);
    });
});