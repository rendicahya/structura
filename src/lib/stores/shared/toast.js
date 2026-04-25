import { writable } from 'svelte/store';

export const toasts = writable([]);

let toastId = 0;

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
  info:    (msg, duration) => addToast(msg, 'info',    duration),
  success: (msg, duration) => addToast(msg, 'success', duration),
  warning: (msg, duration) => addToast(msg, 'warning', duration),
  error:   (msg, duration) => addToast(msg, 'error',   duration),
};