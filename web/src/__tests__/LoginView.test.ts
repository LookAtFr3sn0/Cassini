import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { Unauthorized } from "@/api";
import LoginView from "@/views/LoginView.vue";

const { login, signupOpen } = vi.hoisted(() => ({ login: vi.fn(), signupOpen: vi.fn() }));

vi.mock("@/session", () => ({ login, signupOpen }));

const Empty = { template: "<div />" };

const routes = [
    { path: "/login", name: "login", component: LoginView },
    { path: "/signup", name: "signup", component: Empty },
    { path: "/", name: "recent", component: Empty },
    { path: "/top/:kind", name: "top", component: Empty },
];

async function render(next?: string) {
    const router = createRouter({
        history: createMemoryHistory(),
        routes,
    });

    await router.push({ name: "login", query: next === undefined ? {} : { next } });
    const wrapper = mount(LoginView, { global: { plugins: [router] } });
    return { wrapper, router };
}

async function submit(wrapper: Awaited<ReturnType<typeof render>>["wrapper"], password = "testpass") {
    await wrapper.find("#username").setValue("testuser");
    await wrapper.find("#password").setValue(password);
    await wrapper.find("form").trigger("submit");
    await flushPromises();
}

beforeEach(() => {
    login.mockReset();
    signupOpen.mockReset();
    signupOpen.mockResolvedValue(false);
});

describe("LoginView", () => {
    it("logs in and goes to recent plays", async () => {
        login.mockResolvedValue({ username: "testuser", timezone: "Europe/Paris" });
        const { wrapper, router } = await render();
        await submit(wrapper);
        expect(login).toHaveBeenCalledWith("testuser", "testpass");
        expect(router.currentRoute.value.path).toBe("/");
    });

    it("returns to the page the user asked for", async () => {
        login.mockResolvedValue({ username: "testuser", timezone: "Europe/Paris" });
        const { wrapper, router } = await render("/top/tracks");
        await submit(wrapper);
        expect(router.currentRoute.value.path).toBe("/top/tracks");
    });

    it.each(["//example.com", "https://example.com", "example"])("ignores a next of %s", async (next) => {
        login.mockResolvedValue({ username: "testuser", timezone: "Europe/Paris" });
        const { wrapper, router } = await render(next);
        await submit(wrapper);
        expect(router.currentRoute.value.path).toBe("/");
    });

    it("tells the user when the password is wrong, and stays on the page", async () => {
        login.mockRejectedValue(new Unauthorized());
        const { wrapper, router } = await render();
        await submit(wrapper, "wrongpass");
        expect(wrapper.find("[role='alert']").text()).toBe("Invalid username or password");
        expect(router.currentRoute.value.name).toBe("login");
    });

    it("shows a general error when the server fails", async () => {
        login.mockRejectedValue(new Error("502 Bad Gateway"));
        const { wrapper } = await render();
        await submit(wrapper);
        expect(wrapper.find("[role='alert']").text()).toBe("An unexpected error occurred");
    });

    it("disables the form while loggin in, and clears the old error", async () => {
        login.mockRejectedValueOnce(new Unauthorized());
        const { wrapper } = await render();
        await submit(wrapper, "wrongpass");

        let finish!: (value: unknown) => void;
        login.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
        await wrapper.find("form").trigger("submit");
        expect(wrapper.find("button").attributes("disabled")).toBeDefined();
        expect(wrapper.find("#password").attributes("disabled")).toBeDefined();
        expect(wrapper.find("[role='alert']").exists()).toBe(false);

        finish({ username: "testuser", timezone: "Europe/Paris" });
        await flushPromises();
    });
});
