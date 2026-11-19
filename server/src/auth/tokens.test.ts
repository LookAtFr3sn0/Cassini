import type { FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Condition = {
    column: unknown;
    value?: unknown;
    after?: Date;
    isNull?: true;
}

const USER = { id: "11111111-1111-4111-8111-111111111111", username: "testuser", timezone: "UTC" };

const state = vi.hoisted(() => ({
    found: true,
    lookups: [] as Condition[][],
}));

vi.mock("drizzle-orm", async (importOriginal) => ({
    ...(await importOriginal<typeof import("drizzle-orm")>()),
    and: (...conditions: unknown[]) => conditions.filter(Boolean),
    eq: (column: unknown, value: unknown) => ({ column, value }),
    gt: (column: unknown, value: unknown) => ({ column, after: value as Date }),
    isNull: (column: unknown) => ({ column, isNull: true }),
}));

vi.mock("../lastfm/auth.js", () => ({ hashToken: (token: string) => `hash:${token}` }));

vi.mock("../db/index.js", () => ({
    db: {
        select: () => ({
            from: () => ({
                innerJoin: () => ({
                    where: async (conditions: Condition[]) => {
                        state.lookups.push(conditions);
                        return state.found ? [USER] : [];
                    },
                }),
            }),
        }),
    },
}));

import { apiTokens } from "../db/schema.js";
import { findApiUser, findUserByHeader, SESSION_DAYS } from "./tokens.js";

const request = (authorization?: string, session?: string) => ({ headers: authorization ? { authorization } : {}, cookies: session ? { cassini_session: session } : {} }) as unknown as FastifyRequest;
const condition = (column: unknown) => state.lookups[0]?.find((c) => c.column === column);

beforeEach(() => {
    state.found = true;
    state.lookups.length = 0;
});

describe("findUserByHeader", () => {
    it("looks up the hashed token of the given kind", async () => {
        expect(await findUserByHeader(request("Bearer abc"), "Bearer", "api")).toEqual(USER);
        expect(condition(apiTokens.tokenHash)?.value).toBe("hash:abc");
        expect(condition(apiTokens.kind)?.value).toBe("api");
    });

    it("accepts the scheme in any case", async () => {
        expect(await findUserByHeader(request("token abc"), "Token", "listenbrainz")).toEqual(USER);
    });

    it("skips revoked tokens", async () => {
        await findUserByHeader(request("Bearer abc"), "Bearer", "api");
        expect(condition(apiTokens.revokedAt)).toMatchObject({ isNull: true });
    });

    it("gives api tokens no age limits", async () => {
        await findUserByHeader(request("Bearer abc"), "Bearer", "api");
        expect(condition(apiTokens.createdAt)).toBeUndefined();
    });

    it.each([
        ["no header", undefined],
        ["wrong scheme", "Token abc"],
        ["a scheme without a token", "Bearer"],
        ["an empty header", " "],
    ])("returns nothing for %s without asking the database", async (_name, header) => {
        expect(await findUserByHeader(request(header), "Bearer", "api")).toBeUndefined();
        expect(state.lookups).toHaveLength(0);
    });

    it("returns nothing for an unknown token", async () => {
        state.found = false;
        expect(await findUserByHeader(request("Bearer abc"), "Bearer", "api")).toBeUndefined();
    });
});

describe("findApiUser", () => {
    it("uses the session cookie as a web token", async () => {
        expect(await findApiUser(request(undefined, "abc"))).toEqual(USER);
        expect(condition(apiTokens.tokenHash)?.value).toBe("hash:abc");
        expect(condition(apiTokens.kind)?.value).toBe("web");
    });

    it("only accepts sessions younger than the session lifetime", async () => {
        const before = Date.now();
        await findApiUser(request(undefined, "abc"));
        const after = condition(apiTokens.createdAt)?.after?.getTime();
        expect(after).toBeGreaterThanOrEqual(before - SESSION_DAYS * 24 * 60 * 60 * 1000 - 1000);
        expect(after).toBeLessThanOrEqual(Date.now() - SESSION_DAYS * 24 * 60 * 60 * 1000);
    });

    it("prefers a Bearer header over the cookie", async () => {
        await findApiUser(request("Bearer abc", "def"));
        expect(state.lookups).toHaveLength(1);
        expect(condition(apiTokens.tokenHash)?.value).toBe("hash:abc");
        expect(condition(apiTokens.kind)?.value).toBe("api");
    });

    it("does not fall back to the cookie when the header is wrong", async () => {
        expect(await findApiUser(request("Token abc", "def"))).toBeUndefined();
        expect(state.lookups).toHaveLength(0);
    });

    it("returns nothing without a header or cookie", async () => {
        expect(await findApiUser(request())).toBeUndefined();
        expect(state.lookups).toHaveLength(0);
    });
});
