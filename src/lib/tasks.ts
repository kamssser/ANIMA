import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Status proses panjang (generate Claude, gambar karakter, suara, uji render, dll.) dan isian layar yang
 * harus tetap ada saat pengguna pindah halaman. Komponen halaman dibuang saat pindah menu, jadi state-nya
 * disimpan di sini (tingkat modul), bukan di useState.
 */

export type Task = {
  running: boolean;
  /** judul singkat untuk indikator di sidebar */
  label: string;
  /** halaman tempat proses dimulai (klik indikator kembali ke sini) */
  href: string;
  /** langkah terakhir */
  step: string;
  /** beberapa baris log terakhir */
  log: string[];
  progress?: number;
  data?: unknown;
  startedAt: number;
  finishedAt?: number;
  error?: string;
};

const listeners = new Set<() => void>();
let tasks: Record<string, Task> = {};
let values: Record<string, unknown> = {};

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const cleanErr = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

export function getTask(key: string): Task | undefined {
  return tasks[key];
}

/** Ubah task yang sedang berjalan (event progres yang datang setelah selesai diabaikan). */
export function patchTask(key: string, p: Partial<Task>) {
  const t = tasks[key];
  if (!t?.running) return;
  tasks = { ...tasks, [key]: { ...t, ...p } };
  emit();
}

export function logTask(key: string, line: string) {
  const t = tasks[key];
  if (!t?.running) return;
  patchTask(key, { step: line, log: [...t.log.slice(-5), line] });
}

/**
 * Jalankan proses dan catat statusnya secara global. Hasil/akibatnya (toast, simpan ke store) harus ditangani
 * di `fn` atau di `.then` milik pemanggil, bukan lewat setState komponen, karena komponen bisa sudah dibuang.
 */
export function runTask<T>(key: string, meta: { label: string; href: string; step?: string; data?: unknown }, fn: () => Promise<T>): Promise<T> {
  if (tasks[key]?.running) return Promise.reject(new Error('Proses ini masih berjalan.'));
  const step = meta.step ?? 'Menyiapkan...';
  tasks = { ...tasks, [key]: { running: true, label: meta.label, href: meta.href, step, log: [step], data: meta.data, startedAt: Date.now() } };
  emit();
  const done = (p: Partial<Task>) => {
    tasks = { ...tasks, [key]: { ...tasks[key], ...p, running: false, finishedAt: Date.now() } };
    emit();
  };
  return fn().then(
    (r) => {
      done({});
      return r;
    },
    (e) => {
      done({ error: cleanErr(e) });
      throw e;
    },
  );
}

/** Status satu task (undefined kalau belum pernah dijalankan). */
export function useTask(key: string): Task | undefined {
  return useSyncExternalStore(subscribe, () => tasks[key]);
}

const handled: Record<string, number> = {};
/**
 * Panggil `cb` sekali untuk setiap kali task selesai (sukses atau gagal). Kalau selesai saat komponen sedang
 * dibuang, dipanggil sekali begitu komponen dibuka lagi; setelah itu tidak diulang saat pindah bagian/halaman.
 */
export function useTaskFinished(key: string, cb: (t: Task) => unknown) {
  const t = useTask(key);
  const ref = useRef(cb);
  ref.current = cb;
  const at = t?.finishedAt;
  useEffect(() => {
    const cur = tasks[key];
    if (!at || !cur || handled[key] === at) return;
    handled[key] = at;
    ref.current(cur);
  }, [key, at]);
}

/** Semua task yang sedang berjalan (untuk indikator di sidebar). */
export function useRunningTasks(): [string, Task][] {
  const all = useSyncExternalStore(subscribe, () => tasks);
  return Object.entries(all).filter(([, t]) => t.running);
}

// ---------- Isian layar yang bertahan saat pindah halaman ----------

export function getValue<T>(key: string, initial: T): T {
  return (key in values ? values[key] : initial) as T;
}

export function setValue<T>(key: string, next: T | ((prev: T) => T), initial?: T) {
  const prev = getValue(key, initial as T);
  const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
  if (Object.is(v, prev) && key in values) return;
  values = { ...values, [key]: v };
  emit();
}

/** Seperti useState, tapi nilainya tetap ada walau komponen dibuang lalu dibuka lagi. */
export function usePersisted<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  // Simpan nilai awal sekali, supaya snapshot stabil walau `initial` objek baru di tiap render.
  if (!(key in values)) values[key] = initial;
  const v = useSyncExternalStore(subscribe, () => values[key] as T);
  const set = useCallback((next: T | ((prev: T) => T)) => setValue(key, next, initial), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return [v, set];
}

// ---------- Event dari proses utama, dipasang sekali untuk seluruh aplikasi ----------

let wired = false;
export function wireTaskEvents() {
  if (wired) return;
  wired = true;
  window.anima.onClaudeEvent((e) => logTask(`claude:${e.projectId}`, e.line));
  window.anima.onCharacterEvent((e) => patchTask('character', { step: e.line }));
  window.anima.onVoiceEvent((e) => patchTask(`voice:${e.slug}`, { step: e.step, progress: e.progress }));
  window.anima.onSetupEvent((e) => {
    const t = tasks.setup;
    if (!t?.running) return;
    patchTask('setup', { ...(e.step ? { step: e.step } : {}), ...(e.line ? { log: [e.line] } : {}) });
  });
  window.anima.onBenchEvent((e) => patchTask('bench', { step: e.step, progress: e.progress }));
  window.anima.onAnimateEvent((e) => {
    if (!tasks['animate-setup']?.running) return;
    patchTask('animate-setup', { step: e.step, ...(e.line ? { log: [e.line] } : {}) });
  });
}
