import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import RecentView from "@/views/RecentView.vue";

const api = vi.hoisted(() => vi.fn());

vi.mock("@/api", () => ({ api }));
vi.mock("@/session", () => ({ user: ref({ username: "test", timezone: "Europe/Paris" }) }));

const play = (playedAt: number, track: string, album: string | null = null) => ({ playedAt, track, artist: "Test Artist", album });

async function render() {
    const wrapper = mount(RecentView);
    await flushPromises();
    return wrapper;
}

beforeEach(() => {
    api.mockReset();
});

describe("RecentView", () => {
    it("lists the plays newest first, with the album when one is present", async () => {
        api.mockResolvedValue({ nowPlaying: null, items: [play(1700000300, "Test Track One", "Test Album"), play(1700000000, "Test Track Two")], next: null });
        const wrapper = await render();
        const rows = wrapper.findAll("li .title").map((row) => row.text());
        expect(rows).toEqual(["Test Track One by Test Artist - Test Album", "Test Track Two by Test Artist"]);
        expect(api).toHaveBeenCalledWith("/api/v1/plays");
    });

    it("shows times in the account's timezone", async () => {
        api.mockResolvedValue({ nowPlaying: null, items: [play(1700000000, "Test Track One")], next: null });
        const wrapper = await render();
        const expected = new Date(1700000000 * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
        expect(wrapper.find("time").text()).toBe(expected);
        expect(wrapper.find("time").attributes("datetime")).toBe("2023-11-14T22:13:20.000Z");
    });

    it("shows the currently playing track", async () => {
        api.mockResolvedValue({ nowPlaying: { track: "Test Track One", artist: "Test Artist", album: "Test Album" }, items: [], next: null });
        const wrapper = await render();
        expect(wrapper.text()).toContain("Now playing: Test Track One by Test Artist - Test Album");
    });

    it("adds the next page under the first one", async () => {
        api.mockResolvedValueOnce({ nowPlaying: null, items: [play(1700000300, "Test Track One")], next: 1700000300 });
        api.mockResolvedValueOnce({ nowPlaying: null, items: [play(1700000000, "Test Track Two")], next: null });
        const wrapper = await render();
        await wrapper.find("button").trigger("click");
        await flushPromises();
        expect(api).toHaveBeenLastCalledWith("/api/v1/plays?before=1700000300");
        expect(wrapper.findAll("li")).toHaveLength(2);
        expect(wrapper.find("button").exists()).toBe(false);
    });

    it("keeps the now playing line when loading more", async () => {
        api.mockResolvedValueOnce({ nowPlaying: { track: "Test Track One", artist: "Test Artist", album: "Test Album" }, items: [play(1700000300, "Test Track One", "Test Album")], next: 1700000300 });
        api.mockResolvedValueOnce({ nowPlaying: null, items: [], next: null });
        const wrapper = await render();
        await wrapper.find("button").trigger("click");
        await flushPromises();
        expect(wrapper.text()).toContain("Now playing: Test Track One by Test Artist - Test Album");
    });

    it("has no load more button on the last page", async () => {
        api.mockResolvedValue({ nowPlaying: null, items: [play(1700000300, "Test Track One", "Test Album")], next: null });
        const wrapper = await render();
        expect(wrapper.find("button").exists()).toBe(false);
    });
});
