import Fastify from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
    config: { singleUser: true },
    total: 0,
    conflict: false,
    inserted: [] as Record<string, unknown>[],
}));

vi.mock("../config.js", () => ({ config: state.config }));
vi.mock("../auth/password.js", () => ({ hashPassword: async (password: string) => `hashed:${password}` }));
vi.mock("../db/index.js", () => ({
    db: {
        select: () => ({ from: async () => [{ total: state.total }] }),
        insert: () => ({
            values: (value: Record<string, unknown>) => ({
                onConflictDoNothing: () => ({
                    returning: async () => {
                        if (state.conflict) return [];
                        state.inserted.push(value);
                        return [{ id: "11111111-1111-4111-8111-111111111111", username: value.username }];
                    },
                }),
            }),
        }),
    },
}));

import { signupRoutes } from "./signup.js";

const app = Fastify();
beforeAll(async () => {
    await app.register(signupRoutes);
    await app.ready();
});

afterAll(() => app.close());

beforeEach(() => {
    state.config.singleUser = true;
    state.total = 0;
    state.conflict = false;
    state.inserted.length = 0;
});

const VALID = { username: "testuser", email: "testuser@example.com", password: "correct horse battery staple" };
const signup = (payload: Record<string, unknown>) => app.inject({ method: "POST", url: "/api/signup", payload });

describe("POST /api/signup", () => {
    it("creates the first user as admin", async () => {
        const response = await signup(VALID);
        expect(response.statusCode).toBe(201);
        expect(response.json()).toMatchObject({ username: "testuser" });
        expect(state.inserted[0]).toMatchObject({ username: "testuser", email: "testuser@example.com", isAdmin: true });
    });

    it("stores the hash and never the password", async () => {
        await signup(VALID);
        expect(state.inserted[0]).toMatchObject({ passwordHash: "hashed:correct horse battery staple" });
        expect(state.inserted[0]).not.toHaveProperty("password");
    });

    it("closes signup after the first user on a single user instance", async () => {
        state.total = 1;
        expect((await signup(VALID)).statusCode).toBe(403);
        expect(state.inserted).toHaveLength(0);
    });

    it("lets more users in when single user mode is off", async () => {
        state.config.singleUser = false;
        state.total = 1;
        expect((await signup(VALID)).statusCode).toBe(201);
        expect(state.inserted[0]).toMatchObject({ isAdmin: false });
    });

    it("answers 409 when the username or email is taken", async () => {
        state.conflict = true;
        expect((await signup(VALID)).statusCode).toBe(409);
    });

    it.each([
        ["a short username", { ...VALID, username: "ab" }],
        ["a long username", { ...VALID, username: "a".repeat(33) }],
        ["a username with other characters", { ...VALID, username: "bad name" }],
        ["an email without @", { ...VALID, email: "bademail.com" }],
        ["a short password", { ...VALID, password: "short" }],
        ["a missing password", { username: "testuser", email: "testuser@example.com" }]
    ])("rejects %s", async (_name, payload) => {
        expect((await signup(payload)).statusCode).toBe(400);
        expect(state.inserted).toHaveLength(0);
    });
});
