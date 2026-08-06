import { get } from 'svelte/store';

/**
 * Deep-clones the current value of a Svelte store via JSON round-trip.
 * Used when building undo/redo and save/load snapshots so that later
 * mutations to the live store don't retroactively change a saved snapshot.
 * @template T
 * @param {import('svelte/store').Readable<T>} store
 * @returns {T}
 */
export function cloneStoreValue(store) {
    return JSON.parse(JSON.stringify(get(store)));
}
