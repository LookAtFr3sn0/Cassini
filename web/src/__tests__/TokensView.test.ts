import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import TokensView from "@/views/TokensView.vue";

const api = vi.hoisted(() => vi.fn());

vi.mock("@/api", () => ({ api }));
vi.mock("@/session", () => ({ user: ref({ username: "testuser", timezone: "Europe/Paris" }) }));

const LASTFM = { id: "a", kind: "lastfm", name: "Last.fm client", createdAt: 1700000000 };
const PHONE = { id: "b", kind: "listenbrainz", name: "Phone", createdAt: 1700000300 };
const UNNAMED = { id: "c", kind: "api", name: null, createdAt: 1700000600 };

async function render() {
    const wrapper = mount(TokensView);
    await flushPromises();
    return wrapper;
}

const rows = (wrapper: Awaited<ReturnType<typeof render>>) => wrapper.findAll("li .title").map((row) => row.text());
const revokeButton = (wrapper: Awaited<ReturnType<typeof render>>, index: number) => wrapper.findAll("li button")[index]!;

beforeEach(() => {
    api.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("TokensView", () => {
    it("lists the tokens with their kind", async () => {
        api.mockResolvedValue({ items: [UNNAMED, PHONE, LASTFM] });
        const wrapper = await render();
        expect(api).toHaveBeenCalledWith("/api/tokens");
        expect(rows(wrapper)).toEqual(["Unnamed - API", "Phone - ListenBrainz", "Last.fm client - Last.fm"]);
    });

    it("says so when there are no tokens", async () => {
        api.mockResolvedValue({ items: [] });
        const wrapper = await render();
        const addresses = wrapper.findAll("code").map((code) => code.text());
        expect(addresses).toEqual([window.location.origin, `${window.location.origin}/2.0/`]);
    });

    it("creates a token, shows it and reloads the list", async () => {
        api.mockResolvedValueOnce({ items: [] });
        api.mockResolvedValueOnce({ id: "b", token: "abc" });
        api.mockResolvedValueOnce({ items: [PHONE] });
        const wrapper = await render();
        await wrapper.find("input[aria-label='Name']").setValue("Phone");
        await wrapper.find("form").trigger("submit");
        await flushPromises();

        expect(api).toHaveBeenNthCalledWith(2, "/api/tokens", {
            method: "POST",
            body: { kind: "listenbrainz", name: "Phone" },
        });
        expect((wrapper.find("input[aria-label='New token']").element as HTMLInputElement).value).toBe("abc");
        expect(rows(wrapper)).toEqual(["Phone - ListenBrainz"]);
    });

    it("sends the chosen kind and leaves out an empty name", async () => {
        api.mockResolvedValueOnce({ items: [] });
        api.mockResolvedValueOnce({ id: "c", token: "abc" });
        api.mockResolvedValueOnce({ items: [UNNAMED] });
        const wrapper = await render();
        await wrapper.find("select").setValue("api");
        await wrapper.find("form").trigger("submit");
        await flushPromises();
        expect(api).toHaveBeenNthCalledWith(2, "/api/tokens", {
            method: "POST",
            body: { kind: "api", name: undefined },
        });
    });

    it("copies the new token if the browser allows it", async () => {
        const writeText = vi.fn(async () => {});
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        api.mockResolvedValueOnce({ items: [] });
        api.mockResolvedValueOnce({ id: "b", token: "abc" });
        api.mockResolvedValueOnce({ items: [PHONE] });
        const wrapper = await render();
        await wrapper.find("form").trigger("submit");
        await flushPromises();

        const copy = wrapper.find(".created button");
        await copy.trigger("click");
        await flushPromises();
        expect(writeText).toHaveBeenCalledWith("abc");
        expect(copy.text()).toBe("Copied");
    });

    it("asks for confirmation before revoking a token", async () => {
        api.mockResolvedValueOnce({ items: [PHONE, LASTFM] });
        const wrapper = await render();

        await revokeButton(wrapper, 0).trigger("click");
        expect(api).toHaveBeenCalledTimes(1);
        expect(revokeButton(wrapper, 0).text()).toBe("Confirm revoke");
        expect(revokeButton(wrapper, 1).text()).toBe("Revoke");

        api.mockResolvedValueOnce(undefined);
        await revokeButton(wrapper, 0).trigger("click");
        await flushPromises();
        expect(api).toHaveBeenLastCalledWith("/api/tokens/b", { method: "DELETE" });
        expect(rows(wrapper)).toEqual(["Last.fm client - Last.fm"]);
    });

    it("moves the confermation when another token is clicked", async () => {
        api.mockResolvedValueOnce({ items: [PHONE, LASTFM] });
        const wrapper = await render();
        await revokeButton(wrapper, 0).trigger("click");
        await revokeButton(wrapper, 1).trigger("click");
        expect(revokeButton(wrapper, 0).text()).toBe("Revoke");
        expect(revokeButton(wrapper, 1).text()).toBe("Confirm revoke");
        expect(api).toHaveBeenCalledTimes(1);
    });

    it("shows the creation date in the account's timezone", async () => {
        api.mockResolvedValue({ items: [PHONE] });
        const wrapper = await render();
        const expected = new Date(1700000300 * 1000).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "Europe/Paris" });
        expect(wrapper.find("time").text()).toBe(expected);
    });
});
