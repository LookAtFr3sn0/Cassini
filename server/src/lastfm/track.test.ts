import { describe, expect, it, vi } from "vitest";

vi.mock("../db/index.js", () => ({ db: {} }));

vi.mock("./auth", () => ({ requireSession: async () => "11111111-1111-4111-8111-111111111111" }));

import { normalize, updateNowPlaying } from "./track.js";
import { LastfmErrorCode } from "./shared.js";

describe("normalize", () => {
    it.each([
        ["lowercases", "AbC", "abc"],
        ["trims", "  Radiohead  ", "radiohead"],
        ["collapses inner whitespace", "Daft \t Punk", "daft punk"],
        ["unifies unicode", "Ｂｊöｒｋ", "björk"],
        ["keeps accents", "Sigur Rós", "sigur rós"],
    ])("%s", (_name, input, expected) => {
        expect(normalize(input)).toBe(expected);
    });

    it("gives the same key for the same name written differently", () => {
        expect(normalize("AC/DC")).toBe(normalize("ac/dc"));
    });
});

describe("updateNowPlaying", () => {
    it("rejects parameters that are too long", async () => {
        await expect(updateNowPlaying({ sk: "x", artist: "a".repeat(1025), track: "b" })).rejects.toMatchObject({ code: LastfmErrorCode.InvalidParameters });
    });
});