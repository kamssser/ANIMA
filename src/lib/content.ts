import data from '../../shared/content-types.json';
import type { Project } from './types';
import { WORDS_PER_SECOND } from './utils';

export type ContentTypeId = 'sejarah' | 'fakta' | 'dongeng' | 'karangan' | 'tutorial' | 'dialog' | 'film';

export interface ContentType {
  id: ContentTypeId;
  label: string;
  description: string;
  needsSources: boolean;
  twoVoices: boolean;
  rules: string[];
}

export const CONTENT_TYPES = data.types as ContentType[];
export const HOOK_RULES = data.hookRules as string[];

export const contentType = (id: string | null | undefined): ContentType =>
  CONTENT_TYPES.find((t) => t.id === id) ?? CONTENT_TYPES.find((t) => t.id === 'karangan')!;

/**
 * Prompt pendek (hemat token): aturan lengkap diambil Claude sendiri lewat anima_get_project (field guide).
 * Dipakai tombol "Generate dengan Claude" dan "Salin prompt".
 */
export function buildPrompt(project: Project) {
  const t = contentType(project.content_type);
  const words = Math.round(project.target_seconds * WORDS_PER_SECOND);
  const lines = [
    `Pakai skill cartoon-3d-short. Kerjakan project HyperForge id "${project.id}" (jenis: ${t.label}).`,
    '1. Panggil anima_get_project dengan id itu dan IKUTI semua aturan di field guide (hook + rules).',
    t.needsSources
      ? '2. WAJIB riset dulu dengan WebSearch lalu baca minimal 2 sumber kredibel dengan WebFetch sebelum menulis. Jangan mengarang fakta.'
      : '2. Kembangkan ide dari topik project menjadi cerita yang kuat.',
    `3. Tulis hook (0-3 detik), script narasi ~${words} kata untuk ${project.target_seconds} detik, dan shot list (5-6 detik per shot).`,
    t.twoVoices ? "4. Dua pembicara: isi speaker 'A' atau 'B' di SETIAP shot; narration hanya kalimat yang diucapkan." : '',
    `${t.twoVoices ? 5 : 4}. Simpan dengan anima_save_story (hook, script, ${t.needsSources ? 'sources, ' : ''}shots).`,
    'Bahasa Indonesia. Balas singkat saja: "selesai" + jumlah shot.',
  ];
  return lines.filter(Boolean).join('\n');
}
