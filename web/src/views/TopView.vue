<script setup lang="ts">
import { ref, watch } from "vue";
import { api } from "@/api";

const props = defineProps<{ kind: "artists" | "tracks" | "albums" }>();

type Item = {
    artist: string;
    track?: string;
    album?: string;
    plays: number;
}

const periods = [
    { label: '7 days', days: 7 },
    { label: '30 days', days: 30 },
    { label: '90 days', days: 90 },
    { label: '12 months', days: 365 },
    { label: 'All time', days: 0 }
]

const days = ref(30);
const items = ref<Item[]>([]);
const loading = ref(false);
let request = 0;

async function load() {
    const id = ++request;
    loading.value = true;
    const params = new URLSearchParams({ limit: "50" })
    if (days.value) params.set("from", String(Math.floor(Date.now() / 1000) - days.value * 24 * 60 * 60));
    try {
        const result = await api<{ items: Item[] }>(`/api/v1/stats/top/${props.kind}?${params}`);
        if (id === request) items.value = result.items;
    } finally {
        if (id === request) loading.value = false;
    }
}

watch(() => [props.kind, days.value], load, { immediate: true });

const name = (item: Item) => item.track ?? item.album ?? item.artist;
</script>

<template>
    <h1>Top {{ kind }}</h1>
    <nav class="row">
        <RouterLink to="/top/artists">Artists</RouterLink>
        <RouterLink to="/top/tracks">Tracks</RouterLink>
        <RouterLink to="/top/albums">Albums</RouterLink>
    </nav>
    <div class="row" role="group" aria-label="Period">
        <button v-for="p in periods" :key="p.days" :aria-pressed="days === p.days" @click="days = p.days">{{ p.label }}</button>
    </div>
    <ol>
        <li v-for="(item, index) in items" :key="index">
            <span class="rank">{{ index + 1 }}</span>
            <span class="title">
                <strong>{{ name(item) }}</strong>
                <template v-if="kind !== 'artists'"> by {{ item.artist }}</template>
            </span>
            <span class="count">{{ item.plays }} {{ item.plays === 1 ? 'play' : 'plays' }}</span>
        </li>
    </ol>
    <p v-if="!loading && items.length === 0" class="muted">Nothing played in this period.</p>
</template>
