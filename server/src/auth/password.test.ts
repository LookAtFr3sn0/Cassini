import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("hashPassword", () => {
    it("produces an argon2id hash string with the parameters in it", async () => {
        const password = "correct horse battery staple";
        const hash = await hashPassword(password);
        expect(hash).toMatch(/^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$/);
    });

    it("produces a different hash for the same password each time", async () => {
        const password = "correct horse battery staple";
        const hash1 = await hashPassword(password);
        const hash2 = await hashPassword(password);
        expect(hash1).not.toEqual(hash2);
    });
    it("produces a 32 byte tag", async () => {
        const password = "correct horse battery staple";
        const hash = await hashPassword(password);
        const tagB64 = hash.split("$")[5];
        const tag = Buffer.from(tagB64!, "base64");
        expect(tag).toHaveLength(32);
    });
});

describe("verifyPassword", () => {
    it("returns true for a correct password", async () => {
        const password = "correct horse battery staple";
        const hash = await hashPassword(password);
        const result = await verifyPassword(password, hash);
        expect(result).toBe(true);
    });

    it("returns false for an incorrect password", async () => {
        const password = "correct horse battery staple";
        const hash = await hashPassword(password);
        const result = await verifyPassword("wrong password", hash);
        expect(result).toBe(false);
    });

    it("handles unicode passwords", async () => {
        const password = "pāsswørd😊";
        const hash = await hashPassword(password);
        expect(await verifyPassword(password, hash)).toBe(true);
        expect(await verifyPassword("pāsswørd", hash)).toBe(false);
    });

    it("rejects a stored value that is not an argon2id string", async () => {
        expect(await verifyPassword("anything", "")).toBe(false);
        expect(await verifyPassword("anything", "plaintext")).toBe(false);
        expect(await verifyPassword("anything", "$argon2id$broken$format")).toBe(false);
    });
});