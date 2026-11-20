import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/api";
import DataView from "@/views/DataView.vue";

const api = vi.hoisted(() => vi.fn());

vi.mock("@/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/api")>()),
    api,
}));

const csv = "played_at,artist,track\n2024-01-01T00:00:00.000Z,CSV Artist,CSV Track\n";

async function choose(wrapper: ReturnType<typeof mount>, file: File) {
    const input = wrapper.find("input[type='file']");
    Object.defineProperty(input.element, "files", { value: [file], configurable: true });
    await input.trigger("change");
}

async function importFile(wrapper: ReturnType<typeof mount>) {
    await choose(wrapper, new File([csv], "plays.csv", { type: "text/csv" }));
    await wrapper.find("form").trigger("submit");
    await flushPromises();
}

beforeEach(() => {
    api.mockReset();
});

describe("DataView", () => {
    it("links to the export page", async () => {
        const wrapper = mount(DataView);
        expect(wrapper.find("a[download]").attributes("href")).toBe("/api/v1/export");
    });

    it("keeps the import button off until a file is chosen", async () => {
        const wrapper = mount(DataView);
        expect(wrapper.find("button").attributes("disabled")).toBeDefined();
        await choose(wrapper, new File([csv], "plays.csv", { type: "text/csv" }));
        expect(wrapper.find("button").attributes("disabled")).toBeUndefined();
    });

    it("sends the file as CSV, regardless of the type the browser says it is", async () => {
        api.mockResolvedValue({ imported: 1, duplicates: 0 });
        const wrapper = mount(DataView);
        await importFile(wrapper);

        const [path, options] = api.mock.calls[0]!;
        expect(path).toBe("/api/v1/import");
        expect(options.method).toBe("POST");
        expect(options.body.type).toBe("text/csv");
        expect(options.body.size).toBe(csv.length);
    });

    it("says how many plays came in and how many were duplicates", async () => {
        api.mockResolvedValue({ imported: 1, duplicates: 2 });
        const wrapper = mount(DataView);
        await importFile(wrapper);
        expect(wrapper.find("[role='status']").text()).toBe("Imported 1 play, skipped 2 duplicates");
    });

    it.each([
        [new HttpError(400, "400 Bad Request", "Line 3: played_at is not a date"), "Line 3: played_at is not a date"],
        [new HttpError(413, "413 Payload Too Large"), "The file is too large, the limit is 50 MB"],
        [new HttpError(502, "502 Bad Gateway"), "An unexpected error occurred"],
    ])("explains a failed import", async (error, message) => {
        api.mockRejectedValue(error);
        const wrapper = mount(DataView);
        await importFile(wrapper);
        expect(wrapper.find("[role='alert']").text()).toBe(message);
        expect(wrapper.find("[role='status']").exists()).toBe(false);
    });

    it("disables the form while importing", async () => {
        let finish!: (value: unknown) => void;
        api.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
        const wrapper = mount(DataView);
        await choose(wrapper, new File([csv], "plays.csv", { type: "text/csv" }));
        await wrapper.find("form").trigger("submit");
        expect(wrapper.find("button").text()).toBe("Importing...");

        expect(wrapper.find("input[type='file']").attributes("disabled")).toBeDefined();
        
        finish({ imported: 1, duplicates: 0 });
        await flushPromises();
        expect(wrapper.find("button").text()).toBe("Import");
        expect(wrapper.find("input[type='file']").attributes("disabled")).toBeUndefined();
    })
});
