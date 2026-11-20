<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Unauthorized } from "@/api";
import { login, signupOpen } from "@/session";
import SignupView from "@/views/SignupView.vue";
import TokensView from "@/views/TokensView.vue";

const route = useRoute();
const router = useRouter();

const username = ref("");
const password = ref("");
const canSignUp = ref(false);
const error = ref("");
const loading = ref(false);

async function submit() {
    error.value = "";
    loading.value = true;
    try {
        await login(username.value, password.value);
        const next = route.query.next;
        const safe = typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
        await router.push(safe ? next : "/");
    } catch (err) {
        error.value = err instanceof Unauthorized ? "Invalid username or password" : "An unexpected error occurred";
    } finally {
        loading.value = false;
    }
}

onMounted(async () => {
    canSignUp.value = await signupOpen().catch(() => false);
});
</script>

<template>
    <form class="login" @submit.prevent="submit">
        <h1>Cassini</h1>
        <label for="username">Username</label>
        <input id="username" type="text" autocomplete="username" v-model="username" :disabled="loading" required />
        <label for="password">Password</label>
        <input id="password" type="password" autocomplete="current-password" v-model="password" :disabled="loading" required />
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button type="submit" :disabled="loading">Log in</button>
        <p v-if="canSignUp" class="muted">Don't have an account? <router-link to="/signup">Sign up</router-link></p>
    </form>
</template>

<style scoped lang="scss">
.login {
    max-width: 20rem;
    margin: 4rem auto;
    display: grid;
    gap: .75rem;
}

label {
    display: grid;
    gap: .25rem;
}
</style>
