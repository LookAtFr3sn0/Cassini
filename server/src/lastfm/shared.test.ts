import { describe, expect, it } from "vitest";
import { escapeXml, toXml } from "./shared.js";

describe("escapeXml", () => {
    it("should escape XML special characters", () => {
        expect(escapeXml("&<>'\"")).toBe("&amp;&lt;&gt;&apos;&quot;");
    });

    it("should remove control characters", () => {
        expect(escapeXml("a\u0001b\u0002c")).toBe("abc");
    });
});

describe("toXml", () => {
    it("should convert scalar values to XML", () => {
        expect(toXml("name", "x")).toBe("<name>x</name>");
        expect(toXml("subscriber", 0)).toBe("<subscriber>0</subscriber>");
        expect(toXml("track", null)).toBe("<track></track>");
        expect(toXml("track", undefined)).toBe("<track></track>");
        expect(toXml("name", "A & B")).toBe("<name>A &amp; B</name>");
        expect(toXml("session", { "name": "a", "key": "b", subscriber: 0 })).toBe("<session><name>a</name><key>b</key><subscriber>0</subscriber></session>");
        expect(toXml("artist", { "#text": "A & B", corrected: 0 })).toBe('<artist corrected="0">A &amp; B</artist>');
        expect(toXml("ignoredMessage", { code: 0, "#text": "" })).toBe('<ignoredMessage code="0"></ignoredMessage>');
        expect(toXml("a",  { "#text": "x", "title": "say 'hi'" })).toBe('<a title="say &apos;hi&apos;">x</a>');
        expect(toXml("scrobbles", { "@attr": { accepted: 1, ignored: 0 }, scrobble: "x" })).toBe('<scrobbles accepted="1" ignored="0"><scrobble>x</scrobble></scrobbles>');
        expect(toXml("tag", ["a", "b"])).toBe('<tag>a</tag><tag>b</tag>');
        expect(toXml("tag", [])).toBe('');
        expect(toXml("tags", { "@attr": { count: 2 }, tag: [{ name: "a" }, { "@attr": { top: "true" }, name: "b" }] })).toBe('<tags count="2"><tag><name>a</name></tag><tag top="true"><name>b</name></tag></tags>');
    });
});
