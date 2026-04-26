import { writable } from 'svelte/store';

/** @type {import('svelte/store').Writable<{id: number, message: string, type: string, duration: number}[]>} */
export const toasts = writable([]);

let toastId = 0;

/**
 * @param {string} message
 * @param {string} [type]
 * @param {number} [duration]
 */
export function addToast(message, type = 'info', duration = 3000) {
  const id = ++toastId;
  toasts.update(t => [...t, { id, message, type, duration }]);
  return id;
}

export function removeToast(id) {
  toasts.update(t => t.filter(toast => toast.id !== id));
}

// Shorthand helpers
export const toast = {
  /** @param {string} msg @param {number} [duration] */
  info: (msg, duration) => addToast(msg, 'info', duration),

  /** @param {string} msg @param {number} [duration] */
  success: (msg, duration) => addToast(msg, 'success', duration),

  /** @param {string} msg @param {number} [duration] */
  warning: (msg, duration) => addToast(msg, 'warning', duration),

  /** @param {string} msg @param {number} [duration] */
  error: (msg, duration) => addToast(msg, 'error', duration),
};