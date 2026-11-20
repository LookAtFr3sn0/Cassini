import { config } from "../config.js";

export type Recommendation = {
    artist: string;
    title: string;
    album: string | null;
    mbid: string | null;
    score: number;
    reason: string;
}

export const DEFAULT_SOURCE = "builtin";
const TIMEOUT_MS = 10_000;

async function ask<T>(source: string, path: string): Promise<T> {
    const response = await fetch(new URL(path, config.recommenders.get(source)), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
        throw new Error(`Recommender ${source} answered with ${response.status} ${response.statusText}`);
    }
    return await response.json() as T;
}

export const sources = () => [...config.recommenders.keys()];
export const hasSource = (source: string) => config.recommenders.has(source);

export async function modesOf(source: string) {
    return (await ask<{ modes: string[] }>(source, "/modes")).modes;
}

export async function recommend(source: string, userId: string, mode: string, limit: number) {
    const query = new URLSearchParams({ user_id: userId, mode, limit: String(limit) });
    return (await ask<{ items: Recommendation[] }>(source, `/recommendations?${query}`)).items;
}
