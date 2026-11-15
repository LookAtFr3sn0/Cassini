import { describe, expect, it, vi } from "vitest";

vi.mock("../db/index.js", () => ({ db: {} }));

import { normalize } from "./track.js";

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
