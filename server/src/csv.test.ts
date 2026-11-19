import { describe, expect, it } from "vitest";
import { cell, CsvError, parseCsv } from "./csv.js";

const cells = (text: string) => parseCsv(text).map((row) => row.cells);

describe("parseCsv", () => {
    it("splits rows and cells", () => {
        expect(cells("a,b\r\nc,d\r\n")).toEqual([["a", "b"], ["c", "d"]]);
    });

    it("accepts plain newlines and a missing final newline", () => {
        expect(cells("a,b\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
    });

    it("keeps empty cells", () => {
        expect(cells("a,,\n")).toEqual([["a", "", ""]]);
    });

    it("reads quoted values with commas, double quotes, and line breaks", () => {
        expect(cells('"a, b","c ""d""","two\nlines"\n')).toEqual([["a, b", 'c "d"', "two\nlines"]]);
    });

    it("skips empty lines", () => {
        expect(cells("a\n\n\nb\n")).toEqual([["a"], ["b"]]);
    });

    it("drops a byte order mark", () => {
        expect(cells("\uFEFFplayed_at,artist\n")).toEqual([["played_at", "artist"]]);
    });

    it("numbers rows by the line they end on", () => {
        expect(parseCsv('a\n"b\nc"\nd\n').map((row) => row.line)).toEqual([1, 3, 4]);
    });

    it("keeps a quote inside an unquoted value", () => {
        expect(cells('12" Mix,b\n')).toEqual([["12\" Mix", "b"]]);
    });

    it("fails on a quote that is never closed", () => {
        expect(() => parseCsv('a\n"b,c\n')).toThrow(new CsvError(2, "a quoted value is never closed"));
    });
});

describe("cell", () => {
    it("leaves plain values alone", () => {
        expect(cell("Artist")).toBe("Artist");
    });

    it("quotes values that need it, and reads back the same", () => {
        const values = ['a,b', 'c"d"', "two\nlines", "end\r"];
        expect(cells(values.map(cell).join(",") + "\r\n")).toEqual([values]);
    });
});
