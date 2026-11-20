import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TopView from '@/views/TopView.vue';

const api = vi.hoisted(() => vi.fn());

vi.mock('@/api', () => ({ api }));

const NOW = 1_700_000_000;
const DAY = 24 * 60 * 60;

async function render(kind: "artists" | "tracks" | "albums" = "artists") {
    const wrapper = mount(TopView, { props: { kind }, global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();
    return wrapper;
}

const requested = (call = -1) => new URL(api.mock.calls.at(call)![0] as string, "http://localhost");
const period = (wrapper: Awaited<ReturnType<typeof render>>, label: string) => wrapper.findAll("[role='group'] button").find((button) => button.text() === label)!;

beforeEach(() => {
    api.mockReset();
    api.mockResolvedValue({ items: [] });
    vi.spyOn(Date, "now").mockReturnValue(NOW * 1000);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("TopView", () => {
    it("asks for the top 50 of the last 30 days by default", async () => {
        await render("tracks");
        expect(requested().pathname).toBe("/api/v1/stats/top/tracks");
        expect(requested().searchParams.get("limit")).toBe("50");
        expect(requested().searchParams.get("from")).toBe(String(NOW - 30 * DAY));
    });

    it("marks the chosen period as pressed", async () => {
        const wrapper = await render();
        expect(period(wrapper, "30 days").attributes("aria-pressed")).toBe("true");
        expect(period(wrapper, "7 days").attributes("aria-pressed")).toBe("false");
    });

    it("asks again with the new period when changed", async () => {
        const wrapper = await render();
        await period(wrapper, "7 days").trigger("click");
        await flushPromises();
        expect(requested().searchParams.get("from")).toBe(String(NOW - 7 * DAY));
    });

    it("sends no start for all time", async () => {
        const wrapper = await render();
        await period(wrapper, "All time").trigger("click");
        await flushPromises();
        expect(requested().searchParams.has("from")).toBe(false);
    });

    it("asks again with the new kind when changed", async () => {
        const wrapper = await render("artists");
        await wrapper.setProps({ kind: "albums" });
        await flushPromises();
        expect(requested().pathname).toBe("/api/v1/stats/top/albums");
    });

    it("shows the artist next to tracks and albums", async () => {
        api.mockResolvedValue({ items: [{ track: "Test Track", artist: "Test Artist", plays: 2 }] });
        const wrapper = await render("tracks");
        expect(wrapper.find(".title").text().replace(/\s+/g, " ")).toBe("Test Track by Test Artist");
    });

    it("ignores an older answer that arrives after a newer one", async () => {
        let finishOld!: (value: unknown) => void;
        api.mockReturnValueOnce(new Promise((resolve) => (finishOld = resolve)));
        const wrapper = mount(TopView, { props: { kind: "artists" }, global: { stubs: { RouterLink: RouterLinkStub } } });
        api.mockResolvedValueOnce({ items: [{ artist: "New Artist", plays: 1 }] });
        await period(wrapper, "7 days").trigger("click");
        await flushPromises();

        finishOld({ items: [{ artist: "Old Artist", plays: 3 }] });
        await flushPromises();
        expect(wrapper.find(".title").text()).toBe("New Artist");
    });

    it("says so when nothing was played in the period", async () => {
        const wrapper = await render();
        expect(wrapper.find(".muted").text()).toBe("Nothing played in this period.");
    });

    it("links to the three kinds", async () => {
        const wrapper = await render();
        expect(wrapper.findAllComponents(RouterLinkStub).map((link) => link.props("to"))).toEqual(["/top/artists", "/top/tracks", "/top/albums"]);
    })
});