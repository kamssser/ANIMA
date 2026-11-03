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

/**
 * Brief untuk skill animate (cth9191/animate) di Claude Code. Skill-nya tidak diubah: brief ini hanya
 * menjawab sebagian pertanyaan intake dari isi project dan menjelaskan sumber suara HyperForge.
 */
export function buildAnimateBrief(project: Project, slug: string) {
  const t = contentType(project.content_type);
  const st = visualStyle(project.visual_style);
  const custom = st.skillStyle === 'custom';
  const lines = [
    `# Brief HyperForge: ${project.title}`,
    '',
    'Brief ini dari aplikasi HyperForge. Jalankan skill animate seperti biasa (intake, check-in story, look, storyboard, build, review). Tanyakan hanya yang belum dijawab di sini.',
    '',
    '## Bahasa',
    'Narasi, teks di layar, dan percakapan dengan pengguna memakai **Bahasa Indonesia**.',
    '',
    '## Isi',
    `- Topik / ide: ${project.topic || project.title}`,
    project.hook ? `- Hook yang sudah ada: ${project.hook}` : '',
    project.script.trim() ? `- Script yang sudah ada (boleh dipakai sebagai dasar, sesuaikan dengan grammar skill):\n\n${project.script.trim()}\n` : '',
    `- Jenis konten: ${t.label}. Aturan:`,
    ...t.rules.map((r) => `  - ${r}`),
    ...HOOK_RULES.map((r) => `  - ${r}`),
    t.needsSources ? '- Wajib riset: setiap fakta di layar dicek dengan web search, minimal 2 sumber, dicatat di brief.md piece.' : '',
    '',
    '## Bentuk',
    `- Panjang: sekitar ${project.target_seconds} detik.`,
    `- Format utama: ${project.format === '16:9' ? '16:9 (YouTube)' : '9:16 (Shorts/TikTok/Reels)'}.`,
    custom
      ? '- Style: **dari referensi pengguna** (new-style.md). Minta link atau file referensinya.'
      : `- Style: **${st.skillStyle}** (sudah dipilih di HyperForge, tidak perlu galeri kecuali pengguna mau ganti).`,
    '- **Teks di layar wajib**: kalimat narasi atau caption tampil di layar di setiap beat (aturan HyperForge untuk semua style). Pastikan lolos text check di review.',
    '',
    '## Suara (voice-over narasi)',
    '- Sumber suara = **rekaman milik pengguna, satu file per kalimat** (SKILL.md > Voice-over langkah 3), dibuat lewat alat MCP **anima_vibi_voice** dengan suara yang sudah dipilih pengguna di HyperForge (vibi.pro).',
    '- Urutan: tulis `voice/script.json` -> panggil `anima_vibi_voice` dengan `estimate: true` -> sebutkan suara dan jumlah karakter (kredit) ke pengguna dan minta persetujuan -> panggil tanpa estimate -> `node <skill>/tools/voice.mjs pieces/' + slug + ' --model small` (model multibahasa untuk Bahasa Indonesia).',
    t.twoVoices ? '- Jenis ini memakai **dua pembicara**: isi `"speaker": "A"` atau `"B"` di setiap kalimat script.json; anima_vibi_voice memakai suara A/B pengguna.' : '',
    '- Boleh `--scratch` untuk timing sementara, tapi video akhir wajib memakai take dari anima_vibi_voice.',
    '- Musik: dikomposisi dalam kode (bawaan skill), kecuali pengguna memberi track sendiri.',
    '',
    '## Hasil',
    `- Piece: \`pieces/${slug}/\`. Video akhir \`renders/share.mp4\` (HyperForge mengambilnya dari sana).`,
  ];
  return lines.filter((l) => l !== '').join('\n') + '\n';
}
