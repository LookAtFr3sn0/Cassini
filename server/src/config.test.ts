import { afterEach, describe, expect, it, vi } from "vitest";

const load = async (singleUser: string | undefined, databaseUrl = "postgres://test") => {
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", databaseUrl);
    vi.stubEnv("SINGLE_USER", singleUser);
    return (await import("./config.js")).config;
};

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("config", () => {
    it.each([
        [undefined, true],
        ["true", true],
        ["TRUE", true],
        ["false", false],
        ["no", false],
        ["0", false],
    ])("parses SINGLE_USER=%s as %s", async (value, expected) => {
        expect((await load(value)).singleUser).toBe(expected);
    });

    it("refuses to start without a database URL", async () => {
        await expect(load(undefined, "")).rejects.toThrow("DATABASE_URL");
    });
});