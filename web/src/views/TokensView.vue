<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "@/api";
import { user } from "@/session";

type Kind = "lastfm" | "listenbrainz" | "api";
type Token = { id: string; kind: Kind; name: string | null; createdAt: number };

const labels: Record<Kind, string> = { lastfm: "Last.fm", listenbrainz: "ListenBrainz", api: "API" };

const tokens = ref<Token[]>([]);
const kind = ref<"listenbrainz" | "api">("listenbrainz");
const name = ref("");
const created = ref<string | null>(null);
const copied = ref(false);
const confirming = ref<string | null>(null);
const loading = ref(false);

const origin = window.location.origin;
const canCopy = Boolean(navigator.clipboard?.writeText);

async function load() {
    tokens.value = (await api<{ items: Token[] }>("/api/tokens")).items;
}

async function create() {
    loading.value = true;
    try {
        const result = await api<{ token: string }>("/api/tokens", {
            method: "POST",
            body: { kind: kind.value, name: name.value || undefined },
        });
        created.value = result.token;
        name.value = "";
        copied.value = false;
        await load();
    } finally {
        loading.value = false;
    }
}

async function revoke(id: string) {
    if (confirming.value !== id) {
        confirming.value = id;
        return;
    }
    await api(`/api/tokens/${id}`, { method: "DELETE" });
    confirming.value = null;
    tokens.value = tokens.value.filter((token) => token.id !== id);
}

async function copy() {
    await navigator.clipboard.writeText(created.value!);
    copied.value = true;
}

const date = (seconds: number) => new Date(seconds * 1000).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: user.value?.timezone });

onMounted(load);
</script>

<template>
    <h1>Tokens</h1>
    <p><strong>ListenBrainz clients:</strong> set the server URL to <code>{{ origin }}</code> and use a ListenBrainz token from below.</p>
    <p><strong>Last.fm clients:</strong> set the API URL to <code>{{ origin }}/2.0/</code> and log in with your username and password.  Each client gets its own session, listed here.</p>

    <form class="row" @submit.prevent="create">
        <select v-model="kind" aria-label="Kind">
            <option value="listenbrainz">ListenBrainz</option>
            <option value="api">API</option>
        </select>
        <input v-model="name" maxlength="64" placeholder="Name (optional)" aria-label="Name" />
        <button type="submit" :disabled="loading">Create token</button>
    </form>

    <div v-if="created" class="created" role="status">
        <p>Copy this token now, it won't be shown again.</p>
        <div class="row">
            <input :value="created" readonly aria-label="New token" @focus="($event.target as HTMLInputElement).select()" />
            <button v-if="canCopy" type="button" @click="copy">{{ copied ? "Copied" : "Copy" }}</button>
        </div>
    </div>

    <ol>
        <li v-for="token in tokens" :key="token.id">
            <span class="title"><strong>{{ token.name ?? "Unnamed" }}</strong> - {{ labels[token.kind]  }}</span>
            <time :datetime="new Date(token.createdAt * 1000).toISOString()">{{ date(token.createdAt) }}</time>
            <button type="button" @click="revoke(token.id)">{{ confirming === token.id ? "Confirm revoke" : "Revoke" }}</button>
        </li>
    </ol>
    <p v-if="tokens.length === 0" class="muted">No tokens yet.</p>
</template>

<style scoped lang="scss">
.created input {
    flex: 1;
    font-family: monospace;
}
</style>
