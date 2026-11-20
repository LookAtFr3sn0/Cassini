<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "@/api";
import { user } from "@/session";

type Track = {
    track: string;
    artist: string;
    album: string | null;
};
type Play = Track & { playedAt: number };
type Page = {
    nowPlaying: Track | null;
    items: Play[];
    next: number | null;
};

const plays = ref<Play[]>([]);
const playing = ref<Track | null>(null);
const next = ref<number | null>(null);
const loading = ref(false);

async function load(before?: number) {
    loading.value = true;
    try {
        const page = await api<Page>(before ? `/api/v1/plays?before=${before}` : "/api/v1/plays");
        if (!before) {
            playing.value = page.nowPlaying;
        }
        plays.value.push(...page.items);
        next.value = page.next;
    } finally {
        loading.value = false;
    }
}

const time = (seconds: number) => new Date(seconds * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: user.value?.timezone });

onMounted(() => load());
</script>

<template>
    <h1>Recent plays</h1>
    <p v-if="playing">Now playing: <strong>{{ playing.track }}</strong> by {{ playing.artist }}<template v-if="playing.album"> - {{ playing.album }}</template></p>
    <ol>
        <li v-for="play in plays" :key="`${play.playedAt}-${play.track}`">
            <span class="title"><strong>{{ play.track }}</strong> by {{ play.artist }}<template v-if="play.album"> - {{ play.album }}</template> </span>
            <time :datetime="new Date(play.playedAt * 1000).toISOString()">{{ time(play.playedAt) }}</time>
        </li>
    </ol>
    <p v-if="!loading && plays.length === 0" class="muted">No plays found. Point a scrobbler at this server to start recording your listening history.</p>
    <button v-if="next" :disabled="loading" @click="load(next)">Load more</button>
</template>
