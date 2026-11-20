import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { HttpError } from "@/api";
import SignupView from "@/views/SignupView.vue";

const signup = vi.hoisted(() => vi.fn());

vi.mock("@/session", () => ({ signup }));

const Empty = { template: "<div />" };

const routes = [
    { path: "/signup", name: "signup", component: SignupView },
    { path: "/login", name: "login", component: Empty },
    { path: "/tokens", name: "tokens", component: Empty },
];

async function render() {
    const router = createRouter({
        history: createMemoryHistory(),
        routes,
    });

    await router.push("/signup");
    const wrapper = mount(SignupView, { global: { plugins: [router] } });
    return { wrapper, router };
}

async function submit(wrapper: Awaited<ReturnType<typeof render>>["wrapper"]) {
    await wrapper.find("#username").setValue("testuser");
    await wrapper.find("#email").setValue("testuser@example.com");
    await wrapper.find("#password").setValue("testpass");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
}

beforeEach(() => {
    signup.mockReset();
});

describe("SignupView", () => {
    it("signs up and goes to the tokens page", async () => {
        signup.mockResolvedValue({ username: "testuser", timezone: "Europe/Paris" });
        const { wrapper, router } = await render();
        await submit(wrapper);
        expect(signup).toHaveBeenCalledWith("testuser", "testuser@example.com", "testpass");
        expect(router.currentRoute.value.path).toBe("/tokens");
    });

    it.each([
        [400, "Check that all fields are filled in."],
        [403, "Signups are disabled on this server."],
        [409, "This username or email is already taken."],
        [502, "An unexpected error occurred."],
    ])("explains a %i error", async (status, message) => {
        signup.mockRejectedValue(new HttpError(status, `${status}`));
        const { wrapper, router } = await render();
        await submit(wrapper);
        expect(wrapper.find("[role='alert']").text()).toBe(message);
        expect(router.currentRoute.value.path).toBe("/signup");
    });

    it("disables the form while signing up", async () => {
        let finish!: (value: unknown) => void;
        signup.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
        const { wrapper } = await render();
        await wrapper.find("form").trigger("submit");
        expect(wrapper.find("button").attributes("disabled")).toBeDefined();
        expect(wrapper.find("#username").attributes("disabled")).toBeDefined();
        expect(wrapper.find("#email").attributes("disabled")).toBeDefined();
        expect(wrapper.find("#password").attributes("disabled")).toBeDefined();
        finish({ username: "testuser", timezone: "Europe/Paris" });
        await flushPromises();
    });

    it("asks the browser to check the fields the server checks", async () => {
        const { wrapper } = await render();
        expect(wrapper.find("#username").attributes()).toMatchObject({ minlength: "3", maxlength: "32", required: "" });
        expect(wrapper.find("#email").attributes("type")).toBe("email");
        expect(wrapper.find("#password").attributes()).toMatchObject({ minlength: "8", maxlength: "256", autocomplete: "new-password", required: "" });
    });

    it("links back to login", async () => {
        const { wrapper } = await render();
        expect(wrapper.find("a[href='/login']").exists()).toBe(true);
    });
});
