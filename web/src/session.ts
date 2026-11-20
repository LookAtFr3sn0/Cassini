import { ref } from "vue";
import { api, Unauthorized } from "./api";

export type User = { username: string; timezone: string };

export const user = ref<User | null>(null);
let checked = false;

export async function loadSession() {
    if (checked) return user.value;
    try {
        user.value = await api<User>("/api/session");
    } catch (error) {
        if (!(error instanceof Unauthorized)) throw error;
        user.value = null;
    }
    checked = true;
    return user.value;
}

export async function login(username: string, password: string) {
    await api("/api/session", { method: "POST", body: { username, password } });
    checked = false;
    return loadSession();
}

export async function logout() {
    await api("/api/session", { method: "DELETE" });
    user.value = null;
}

export async function signup(username: string, email: string, password: string) {
    await api("/api/signup", { method: "POST", body: { username, email, password } });
    return login(username, password);
}

export async function signupOpen() {
    return (await api<{ open: boolean }>("/api/signup")).open;
}
