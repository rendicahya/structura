import { writable } from 'svelte/store';

export const fitToViewTrigger = writable(0);

export function triggerFitToView() {
    fitToViewTrigger.update(n => n + 1);
}