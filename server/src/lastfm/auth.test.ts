import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
    rows: new Map<unknown, unknown[]>(),
    inserted: [] as Record<string, unknown>[],
}));

vi.mock("../db/index.js", () => ({
    db: {
        select: () => ({
            from: (table: unknown) => ({
                where: async () => state.rows.get(table) ?? [],
            }),
        }),
        insert: () => ({
            values: async (value: Record<string, unknown>) => {
                state.inserted.push(value);
            },
        }),
    },
}));

import { hashPassword } from "../auth/password.js";
import { apiTokens, users } from "../db/schema.js";
import { getMobileSession, requireSession } from "./auth.js";
import { LastfmErrorCode } from "./shared.js";

const PASSWORD = "correct horse battery staple";
const user = { id: "11111111-1111-4111-8111-111111111111", username: "testuser", passwordHash: "" };

beforeAll(async () => {
    user.passwordHash = await hashPassword(PASSWORD);
});

beforeEach(() => {
    state.rows.clear();
    state.inserted.length = 0;
});

describe("getMobileSession", () => {
    it("rejects a request without username or password", async () => {
        await expect(getMobileSession({})).rejects.toMatchObject({ code: LastfmErrorCode.InvalidParameters });
        await expect(getMobileSession({ username: "testuser" })).rejects.toMatchObject({ code: LastfmErrorCode.InvalidParameters });
    });
    
    it("rejects an unknown user", async () => {
        await expect(getMobileSession({ username: "nobody", password: PASSWORD })).rejects.toMatchObject({ code: LastfmErrorCode.AuthenticationFailed });
    });

    it("rejects a wrong password and creates no session", async () => {
        state.rows.set(users, [user]);
        await expect(getMobileSession({ username: user.username, password: "wrong" })).rejects.toMatchObject({ code: LastfmErrorCode.AuthenticationFailed });
        expect(state.inserted).toHaveLength(0);
    });

    it("returns a session key for the right password", async () => {
        state.rows.set(users, [user]);
        const result = await getMobileSession({ username: user.username, password: PASSWORD });
        const { session } = result.json as { session: { name: string; key: string; subscriber: number } };

        expect(session.name).toBe(user.username);
        expect(session.key).toMatch(/^[0-9a-f]{32}$/);
        expect(result.xml).toContain(`<key>${session.key}</key>`);
    });

    it("stores the hash of the key and never the key itself", async () => {
        state.rows.set(users, [user]);
        const result = await getMobileSession({ username: user.username, password: PASSWORD });
        const { key } = (result.json as { session: { key: string } }).session;

        expect(state.inserted).toHaveLength(1);
        expect(state.inserted[0]).toMatchObject({
            userId: user.id,
            kind: "lastfm",
            tokenHash: createHash("sha256").update(key).digest("hex")
        });
        expect(JSON.stringify(state.inserted[0])).not.toContain(key);
    });
});

describe("requireSession", () => {
    it("rejects a request without a session key", async () => {
        await expect(requireSession({ })).rejects.toMatchObject({ code: LastfmErrorCode.InvalidSessionKey });
    });
    
    it("rejects a session key that is not in the database", async () => {
        await expect(requireSession({ sk: "0".repeat(32) })).rejects.toMatchObject({ code: LastfmErrorCode.InvalidSessionKey });
    });

    it("returns the user id for a known session key", async () => {
        state.rows.set(apiTokens, [{ userId: user.id }]);
        await expect(requireSession({ sk: "0".repeat(32)})).resolves.toBe(user.id);
    });
});
