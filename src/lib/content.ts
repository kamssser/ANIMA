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
/** Aturan tambahan saat jenis satu-narator dipakai dengan 2 suara. */
export const TWO_VOICE_RULES = data.twoVoiceRules as string[];

export const contentType = (id: string | null | undefined): ContentType =>
  CONTENT_TYPES.find((t) => t.id === id) ?? CONTENT_TYPES.find((t) => t.id === 'karangan')!;

/**
 * Project memakai 2 suara (A & B)? Semua jenis konten bisa: pilihan disimpan di assets.voices (1/2);
 * kalau belum dipilih, ikut bawaan jenisnya (Dialog & Film = 2 suara).
 */
export function usesTwoVoices(project: Pick<Project, 'content_type' | 'assets'>) {
  const v = project.assets?.voices;
  return v === 2 ? true : v === 1 ? false : contentType(project.content_type).twoVoices;
}

/** Aturan jenis konten + aturan 2 suara bila project memakainya. */
function typeRules(project: Project) {
  const t = contentType(project.content_type);
  return usesTwoVoices(project) && !t.twoVoices ? [...t.rules, ...TWO_VOICE_RULES] : t.rules;
}

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
  if (usesTwoVoices(project)) steps.push("Dua pembicara (guide.twoSpeakers): isi speaker 'A' atau 'B' di SETIAP shot; narration hanya kalimat yang diucapkan.");
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
    ...typeRules(project).map((r) => `  - ${r}`),
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
    usesTwoVoices(project) ? '- Project ini memakai **dua pembicara**: isi `"speaker": "A"` atau `"B"` di setiap kalimat script.json; anima_vibi_voice memakai suara A/B pengguna.' : '',
    '- Boleh `--scratch` untuk timing sementara, tapi video akhir wajib memakai take dari anima_vibi_voice.',
    '- Musik: dikomposisi dalam kode (bawaan skill), kecuali pengguna memberi track sendiri.',
    '',
    '## Hasil',
    `- Piece: \`pieces/${slug}/\`. Video akhir \`renders/share.mp4\` (HyperForge mengambilnya dari sana).`,
  ];
  return lines.filter((l) => l !== '').join('\n') + '\n';
}

const BANG_GAYA: Record<string, string> = {
  'kartun-kolase': '1 (Kartun kolase)',
  jurnalisme: '2 (Jurnalisme visual)',
  katalog: '3 (Katalog putih)',
  'sketsa-vintage': '4 (Sketsa vintage)',
  'aksi-kontinu': '5 (Aksi kontinu, vektor)',
  'kartun-panggung': '6 (Kartun panggung)',
};

/** Brief untuk skill bang-motion (Bang Tutorial) di Claude Code. Skill-nya tidak diubah. */
export function buildBangBrief(project: Project, slug: string) {
  const t = contentType(project.content_type);
  const st = visualStyle(project.visual_style);
  const opener = st.skillStyle === 'opener';
  const lines = [
    `# Brief HyperForge: ${project.title}`,
    '',
    'Brief ini dari aplikasi HyperForge. Jalankan skill bang-motion seperti biasa: kenali jenisnya, tanyakan hanya yang belum dijawab di sini, tulis style brief + rundown dan minta persetujuan pengguna sebelum menulis kode, bangun, lalu verifikasi frame.',
    '',
    '## Jenis',
    opener
      ? '- Opener / promo / bumper / kinetic typography (tentukan yang paling cocok dari topik; ikuti references/opener-konsep.md).'
      : `- Explainer, **gaya ${BANG_GAYA[st.skillStyle ?? ''] ?? st.label}** (sudah dipilih di HyperForge; references/explainer.md).`,
    '',
    '## Isi',
    `- Topik / ide: ${project.topic || project.title}`,
    project.hook ? `- Hook yang sudah ada: ${project.hook}` : '',
    project.script.trim() ? `- Naskah yang sudah ada (boleh dipakai sebagai dasar naskah VO):\n\n${project.script.trim()}\n` : '',
    `- Jenis konten HyperForge: ${t.label}. Aturan:`,
    ...typeRules(project).map((r) => `  - ${r}`),
    ...HOOK_RULES.map((r) => `  - ${r}`),
    t.needsSources ? '- Wajib fakta bersumber: cek dengan web search, minimal 2 sumber, cantumkan.' : '',
    '',
    '## Bentuk',
    `- Rasio: ${project.format === '16:9' ? '16:9' : '9:16'}. Durasi: sekitar ${project.target_seconds} detik.`,
    '- Bahasa: Indonesia.',
    '- Teks di layar: pengguna HyperForge ingin kata kunci/angka penting terbaca di layar. Tampilkan sejauh hukum gaya mengizinkan (mis. kartun panggung tetap tanpa caption, maksimal dua tingkat teks per adegan).',
    '',
    '## Suara (VO)',
    '- Suara: VO narasi. Bangun dulu dengan timing baca, lalu buat VO lewat alat MCP **anima_vibi_tts** (suara yang sudah dipilih pengguna di HyperForge, vibi.pro) sebagai "VO dari layanan TTS pilihan pengguna".',
    '- Urutan: naskah VO disetujui -> `anima_vibi_tts` dengan `estimate: true`, sebutkan suara dan jumlah karakter (kredit) -> setelah pengguna setuju, buat ke `' + slug + '/vo.mp3` -> retime ke VO (references/explainer.md "Retime ke VO").',
    usesTwoVoices(project) ? '- Project ini memakai **dua pembicara**: panggil anima_vibi_tts per giliran dengan `speaker: "A"` atau `"B"` (file berbeda), lalu gabungkan dengan ffmpeg.' : '',
    '',
    '## Alat di folder kerja',
    '- Skrip skill sudah disalin utuh ke `tools/` (snap.mjs, export-frames.mjs, vo-pauses.html, ...) dan puppeteer sudah terpasang di folder kerja ini. Jalankan dari sini, mis. `node tools/snap.mjs ...`.',
    '- ffmpeg lengkap tersedia di PATH.',
    '',
    '## Hasil',
    `- Folder proyek: \`${slug}/\` (index.html satu berkas).`,
    `- Pengguna HyperForge **meminta MP4**: setelah pengguna menyetujui hasilnya, export frame-by-frame (tools/export-frames.mjs) lalu gabungkan dengan ffmpeg (beserta VO bila ada) menjadi \`${slug}/render/${slug}.mp4\`. HyperForge mengambil video dari folder proyek itu.`,
  ];
  return lines.filter((l) => l !== '').join('\n') + '\n';
}

/** Brief untuk skill HyperForge Studio (skill buatan HyperForge). */
export function buildStudioBrief(project: Project, slug: string, characters: { key: string; name: string; nickname: string; is_main: boolean; personality: string; appearance: string; hasSvg: boolean }[]) {
  const t = contentType(project.content_type);
  const st = visualStyle(project.visual_style);
  const lines = [
    `# Brief HyperForge: ${project.title}`,
    '',
    'Brief dari aplikasi HyperForge. Jalankan skill hyperforge-studio: gaya -> karakter -> naskah -> suara -> storyboard -> render, dengan persetujuan pengguna di setiap tahap. Tanyakan hanya yang belum dijawab di sini.',
    '',
    '## Isi',
    `- Topik / ide: ${project.topic || project.title}`,
    project.hook ? `- Hook yang sudah ada: ${project.hook}` : '',
    project.script.trim() ? `- Naskah yang sudah ada (boleh dipakai sebagai dasar):\n\n${project.script.trim()}\n` : '',
    `- Jenis konten: ${t.label}. Aturan:`,
    ...typeRules(project).map((r) => `  - ${r}`),
    ...HOOK_RULES.map((r) => `  - ${r}`),
    t.needsSources ? '- Wajib riset: setiap fakta dicek dengan web search, minimal 2 sumber, dicatat di naskah.md.' : '',
    '',
    '## Bentuk',
    `- Format: ${project.format === '16:9' ? '16:9 (1920x1080)' : '9:16 (1080x1920)'}. Durasi: sekitar ${project.target_seconds} detik.`,
    `- Gaya: **${st.skillStyle}** (styles/${st.skillStyle}.md), sudah dipilih di HyperForge. Tetap tunjukkan 1 frame contoh untuk disetujui.`,
    '- Teks di layar wajib (subtitle per kata + kata kunci tebal).',
    st.skillStyle === 'explainer-datar'
      ? '- Gaya ini: tokoh & benda WAJIB dari pustaka `kit/explainer-datar.js` (XD), buat lembar tokoh & benda sebelum storyboard, dan **penutup wajib**: pamit + hook ke video berikutnya dengan kartu `XD.penutup` (styles/explainer-datar.md > Penutup). Tanyakan topik video berikutnya saat persetujuan naskah.'
      : '',
    '',
    '## Karakter',
    characters.length
      ? 'Karakter dari HyperForge (Pengaturan > Karakter). Pakai sebagai desain sumber di langkah 2; SVG-nya ada di `' + slug + '/karakter-hyperforge/`:'
      : '- Belum ada karakter di HyperForge: buat karakter baru di langkah 2 (tanya peran dan sifatnya).',
    ...characters.map((c) => `- **${c.name}**${c.nickname ? ` ("${c.nickname}")` : ''}${c.is_main ? ' — karakter utama' : ''}: sifat ${c.personality || '-'}; penampilan ${c.appearance || '-'}${c.hasSvg ? ` (karakter-hyperforge/${c.key}.svg)` : ''}`),
    '',
    '## Suara',
    `- VO dengan \`anima_vibi_tts\` (suara pilihan pengguna di HyperForge): estimate dulu, sebutkan kreditnya, lalu buat ke \`${slug}/audio/vo.mp3\`. Timing kata: \`anima_vibi_words\` -> \`${slug}/audio/words.json\`.`,
    usesTwoVoices(project)
      ? '- **Dua suara** (dipilih pengguna untuk project ini): A = narator/pembawa utama, B = tokoh kedua. Satu file per giliran dengan `speaker: "A"`/`"B"`, lalu gabungkan. Saat minta persetujuan naskah, tandai tiap kalimat dengan A/B.'
      : '- Satu suara (narator, suara A).',
    '',
    '## Hasil',
    `- Folder proyek: \`${slug}/\`. Video akhir di \`${slug}/hasil/\` (video_final.mp4 + video_final_tanpa_musik.mp4); HyperForge mengambilnya dari sana.`,
  ];
  return lines.filter((l) => l !== '').join('\n') + '\n';
}
