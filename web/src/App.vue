<script setup lang="ts">
import { useRouter } from "vue-router";
import { logout, user } from "@/session";

const router = useRouter();

async function signOut() {
    await logout();
    await router.push({ name: "login" });
}
</script>

<template>
    <header v-if="user">
        <strong>Cassini</strong>
        <nav>
            <RouterLink to="/">Recent</RouterLink>
            <RouterLink to="/top/artists" :class="{ active: $route.name === 'top' }">Top Artists</RouterLink>
            <RouterLink to="/tokens" :class="{ active: $route.name === 'tokens' }">Tokens</RouterLink>
        </nav>
        <span class="muted">{{ user.username }}</span>
        <button @click="signOut">Sign Out</button>
    </header>
    <main><RouterView /></main>
</template>

<style lang="scss">
:root {
    color-scheme: light dark;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

body {
    margin: 0;
}

header {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #88888844;

    nav {
        display: flex;
        gap: 0.75rem;
        flex: 1;
    }
}

a {
    color: inherit;
}

.router-link-active, .active {
    font-weight: 600;
}

main {
    max-width: 48rem;
    margin: 0 auto;
    padding: 1rem;
}

ol {
    list-style: none;
    padding: 0;
}

li {
    display: flex;
    gap: .75rem;
    padding: .5rem 0;
    border-bottom: 1px solid #88888822;
}

.title {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
}

.muted, time, .count, .rank {
    color: GrayText;
    white-space: nowrap;
}

.row {
    display: flex;
    gap: .5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
}

button[aria-pressed="true"] {
    font-weight: 600;
}

.error {
    color: #cc2626;
}

</style>
