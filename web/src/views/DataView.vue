<script setup lang="ts">
import { ref } from "vue";
import { api, HttpError } from "@/api";

type Result = { imported: number; duplicates: number };

const file = ref<File | null>(null);
const result = ref<Result | null>(null);
const error = ref("");
const loading = ref(false);

function choose(event: Event) {
    file.value = (event.target as HTMLInputElement).files?.[0] ?? null;
    result.value = null;
    error.value = "";
}

async function submit() {
    if (!file.value) return;
    error.value = "";
    result.value = null;
    loading.value = true;

    try {
        const body = new Blob([file.value], { type: "text/csv" });
        result.value = await api<Result>("/api/v1/import", { method: "POST", body });
    } catch (err) {
        if (err instanceof HttpError && err.status === 413) error.value = "The file is too large, the limit is 50 MB";
        else error.value = (err instanceof HttpError && err.detail) || "An unexpected error occurred.";
    } finally {
        loading.value = false;
    }
}

const plays = (count: number) => `${count} ${count === 1 ? "play" : "plays"}`;
</script>

<template>
    <h1>Import / Export</h1>
    <h2>Import</h2>
    <form class="row" @submit.prevent="submit">
        <input type="file" accept=".csv,text/csv" aria-label="CSV file" @change="choose" :disabled="loading" />
        <button type="submit" :disabled="loading || !file">{{ loading ? "Importing..." : "Import" }}</button>
    </form>

    <p v-if="result" class="success" role="status">Imported {{  plays(result.imported) }}, skipped {{ plays(result.duplicates) }} duplicates</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <h2>Export</h2>
    <p><a href="/api/v1/export" download>Download CSV</a> with all your plays.</p>
</template>
