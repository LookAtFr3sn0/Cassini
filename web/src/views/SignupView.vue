<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { HttpError } from "@/api";
import { signup } from "@/session";

const router = useRouter();
const username = ref("");
const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

const messages: Record<number, string> = {
    400: "Check that all fields are filled in.",
    403: "Signups are disabled on this server.",
    409: "This username or email is already taken.",
};

async function submit() {
    error.value = "";
    loading.value = true;
    try {
        await signup(username.value, email.value, password.value);
        await router.push("/tokens");
    } catch (err) {
        error.value = (err instanceof HttpError && messages[err.status]) || "An unexpected error occurred.";
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <form class="signup" @submit.prevent="submit">
        <h1>Create an account</h1>
        <label for="username">Username</label>
        <input id="username" type="text" v-model="username" autocomplete="username" pattern="^[a-zA-Z0-9_\-]{3,32}$" minlength="3" maxlength="32" :disabled="loading" required />
        <label for="email">Email</label>
        <input id="email" type="email" v-model="email" autocomplete="email" maxlength="255" :disabled="loading" required />
        <label for="password">Password</label>
        <input id="password" type="password" v-model="password" autocomplete="new-password" minlength="8" maxlength="256" :disabled="loading" required />
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button type="submit" :disabled="loading">Sign up</button>
        <p class="muted">Already have an account? <RouterLink to="/login">Log in</RouterLink></p>
    </form>
</template>

<style scoped lang="scss">
.signup {
    max-width: 20rem;
    margin: 4rem auto;
    display: grid;
    gap: 0.75rem;
}
</style>
