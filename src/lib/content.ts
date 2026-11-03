import data from '../../shared/content-types.json';
import type { Project } from './types';
import { is2D, visualStyle } from './styles';
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
  const two = is2D(project.visual_style);
  const st = visualStyle(project.visual_style);
  const steps: string[] = [
    `Panggil anima_get_project dengan id itu dan IKUTI semua aturan di field guide (hook + rules${two ? ' + style + stage + background' : ''}).`,
    t.needsSources
      ? 'WAJIB riset dulu dengan WebSearch lalu baca minimal 2 sumber kredibel dengan WebFetch sebelum menulis. Jangan mengarang fakta.'
      : 'Kembangkan ide dari topik project menjadi cerita yang kuat.',
    `Tulis hook (0-3 detik), script narasi ~${words} kata untuk ${project.target_seconds} detik, dan shot list (${two ? '3-6' : '5-6'} detik per shot). Narasi tampil sebagai teks di layar.`,
  ];
  if (t.twoVoices) steps.push("Dua pembicara: isi speaker 'A' atau 'B' di SETIAP shot; narration hanya kalimat yang diucapkan.");
  if (two) {
    steps.push(`Style 2D "${st.label}", format ${project.format || '9:16'}: pakai karakter dari guide.characters (karakter utama wajib tampil). Isi world tiap shot: bg, camera, framing, cast, speaker.`);
    if (t.needsSources) steps.push('Untuk tempat/bangunan nyata: anima_find_photos lalu anima_view_photo, dan gambar latar yang bentuk + posisinya mirip foto (isi reference).');
    steps.push('Buat storyboard dulu: untuk tiap shot tentukan apa yang DITUNJUKKAN (tempat/zaman, benda yang disebut kalimat, pose karakter, transisi) sesuai guide.stage.');
    steps.push('Lihat potongan referensi gaya dengan anima_style_references, lalu gambar setiap latar (anima_save_background) dan setiap benda cerita (anima_save_prop, ikuti guide.props) dengan gaya referensi ~90% SEBELUM menyimpan story.');
  }
  steps.push(`Simpan dengan anima_save_story (hook, script, ${t.needsSources ? 'sources, ' : ''}shots). Kalau ditolak, perbaiki sesuai pesannya lalu simpan ulang.`);
  const head = two
    ? `Kerjakan project HyperForge id "${project.id}" (jenis: ${t.label}, style: ${st.label}).`
    : `Pakai skill cartoon-3d-short. Kerjakan project HyperForge id "${project.id}" (jenis: ${t.label}).`;
  return [head, ...steps.map((x, i) => `${i + 1}. ${x}`), 'Bahasa Indonesia. Balas singkat saja: "selesai" + jumlah shot.'].join('\n');
}
