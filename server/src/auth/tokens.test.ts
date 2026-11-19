import type { FasifyRequest } from "fastify";
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
    eq: (column)
}))
