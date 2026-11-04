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
  if (usesTwoVoices(project)) steps.push("Dua pembicara (guide.twoSpeakers): isi speaker 'A' (karakter utama pengguna) atau 'B' (narator; pada jenis Dialog = tokoh kedua) di SETIAP shot; narration hanya kalimat yang diucapkan.");
  else steps.push('Satu suara (suara A): karakter utama pengguna sekaligus menjadi narator, boleh bercerita sebagai dirinya sendiri.');
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
    THUMB_RULE(`pieces/${slug}/renders`),
  ];
  return lines.filter((l) => l !== '').join('\n') + '\n';
}

/** Permintaan pengguna HyperForge untuk semua skill: thumbnail + judul hook setelah video disetujui. */
const THUMB_RULE = (dir: string) =>
  `- Setelah video disetujui, buat juga **thumbnail + judul hook**: tawarkan 5 pasangan judul video (≤ 60 karakter) + teks thumbnail (2-6 kata, satu kata disorot) yang jujur dan dijawab isi video, lalu buat gambar 1280x720 (9:16: juga 1080x1920) dengan gaya video ini: tokoh/benda utama besar berekspresi kuat + judul besar kontras tinggi. Simpan \`${dir}/thumbnail.jpg\` dan \`${dir}/judul.txt\` (judul terpilih, 4 cadangan, judul Shorts/TikTok, deskripsi, 5 hashtag).`;

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
    THUMB_RULE(`${slug}/render`),
    `- Pengguna HyperForge **meminta MP4**: setelah pengguna menyetujui hasilnya, export frame-by-frame (tools/export-frames.mjs) lalu gabungkan dengan ffmpeg (beserta VO bila ada) menjadi \`${slug}/render/${slug}.mp4\`. HyperForge mengambil video dari folder proyek itu.`,
  ];
  return lines.filter((l) => l !== '').join('\n') + '\n';
}

const AV_FORMAT: Record<string, { label: string; durasi: string }> = {
  bongkar: { label: 'Kita Bongkar', durasi: '45-55 detik' },
  'bongkar-25d': { label: 'Kita Bongkar', durasi: '45-55 detik' },
  tur: { label: 'Tur Lingkungan', durasi: '60-80 detik' },
  story: { label: 'Story / Kisah', durasi: '60-80 detik' },
  pov: { label: 'POV "Jadi Si..."', durasi: '45-60 detik' },
  tutorial: { label: 'Tutorial', durasi: '35-50 detik' },
  mitos: { label: 'Mitos vs Fakta', durasi: '35-50 detik' },
  versus: { label: 'Perbandingan A vs B', durasi: '45-60 detik' },
  toplist: { label: 'Top List', durasi: '35-50 detik' },
  kalau: { label: 'Apa Jadinya Kalau', durasi: '40-55 detik' },
  evolusi: { label: 'Evolusi', durasi: '45-60 detik' },
  kuis: { label: 'Kuis / Tebak', durasi: '20-30 detik' },
};

/**
 * Brief untuk skill animantra-vector (paket milik pengguna). Skill dipakai persis: brief hanya menjawab isi permintaan
 * (format, topik, nama proyek), seperti permintaan chat "buat video <format> <topik>".
 */
export function buildAnimantraBrief(project: Project, slug: string, workDir: string) {
  const st = visualStyle(project.visual_style);
  const f = AV_FORMAT[st.skillStyle ?? 'bongkar'] ?? AV_FORMAT.bongkar;
  const iso = st.skillStyle === 'bongkar-25d';
  const lines = [
    `# Brief HyperForge: ${project.title}`,
    '',
    'Brief dari aplikasi HyperForge. Jalankan skill animantra-vector **persis seperti SKILL.md** (cek otomatis sebelum mulai, Alur 1-12, gerbang mutu wajib, pelajaran.md). Brief ini hanya isi permintaannya, sama seperti pengguna mengetik "buat video <format> <topik>" di chat.',
    '',
    '## Permintaan',
    `- Format: **${f.label}**${iso ? ', **versi 2.5D** (pengguna sendiri memilih mode 2.5D isometrik)' : ' (mode 3D bawaan)'}.`,
    `- Topik: ${project.topic || project.title}`,
    project.hook ? `- Hook yang sudah ditulis pengguna (boleh dipakai bila cocok dengan panduan_cerita.md): ${project.hook}` : '',
    project.script.trim() ? `- Catatan/naskah dari pengguna (bahan, bukan pengganti aturan skill):\n\n${project.script.trim()}\n` : '',
    `- Durasi: ikuti format (${f.durasi}). Target di HyperForge: ${project.target_seconds} detik; pakai hanya bila masih masuk akal untuk format ini.`,
    '',
    '## Folder & nama',
    `- Folder sesi = folder kerja ini (\`${workDir}\`). Nama proyek: \`${slug}\` (\`new_project.mjs ${slug} --di "${workDir}" ...\`). Video akhir: \`${slug}/${slug}.mp4\` dan \`${slug}/${slug}_kecil.mp4\`; HyperForge mengambilnya dari folder itu.`,
    '',
    '## Permintaan tambahan pengguna',
    '- **Cerita selesai tuntas**; baris terakhir naskah = kesimpulan singkat + ucapan terima kasih sudah menonton dan sampai jumpa (bukan teaser video berikutnya).',
    '- **Judul cover = hook** yang kuat (angka/kontras/"kenapa"), jujur dan dijawab isi video. `cover.png` dipakai sebagai thumbnail; tulis judul YouTube/Shorts terbaik di `caption.txt` seperti biasa.',
    '',
    '## Suara narasi: vibi.pro (pilihan pengguna)',
    `- Pengguna memakai **vibi.pro** dari HyperForge (suara yang sudah dipilih di HyperForge). Ini menggantikan Alur langkah 4 (gen_vo.mjs / ElevenLabs / VokaStudio / VoiceStudio): jangan menunggu atau menawarkan VoiceStudio/VokaStudio.`,
    `- Caranya: setelah \`ucapan.txt\` jadi, panggil \`anima_vibi_tts\` dengan \`estimate: true\` (sebutkan suara + jumlah karakter), lalu buat ke \`${slug}/vo/take.mp3\` dari teks \`ucapan.txt\` (baris digabung dengan spasi, \`...\` dipertahankan). Ubah ke WAV: \`ffmpeg -y -i ${slug}/vo/take.mp3 -ar 48000 -ac 1 ${slug}/vo/take.wav\`. Lanjutkan Alur langkah 5 (asr.py → prep.py) persis seperti skill.`,
    usesTwoVoices(project)
      ? `- Project ini **2 suara**: tiap baris ucapan.txt diberi pembicara A/B; buat satu file per baris dengan \`speaker\` "A"/"B" (\`${slug}/vo/baris_XX.mp3\`), gabungkan berurutan dengan jeda 0,3 dtk menjadi \`vo/take.wav\`.`
      : '',
    '- Kalau vibi.pro gagal (kredit habis/internet), beri tahu pengguna dan tanyakan; jangan diam-diam pindah ke sumber suara lain.',
    '',
    '## Obrolan',
    '- Pengguna mengobrol lewat panel Claude di aplikasi HyperForge (bukan terminal). Ikuti bagian "Pengguna awam" skill. Gambar/video yang kamu sebut path lengkapnya tampil di panel.',
  ];
  return lines.filter((l) => l !== '').join('\n') + '\n';
}

/** Bagian isi yang sama untuk semua brief skill baru (topik, hook, naskah, aturan jenis konten). */
function isiLines(project: Project) {
  const t = contentType(project.content_type);
  return [
    `- Topik / ide: ${project.topic || project.title}`,
    project.hook ? `- Hook yang sudah ada: ${project.hook}` : '',
    project.script.trim() ? `- Naskah yang sudah ada (boleh dipakai sebagai dasar):\n\n${project.script.trim()}\n` : '',
    `- Jenis konten HyperForge: ${t.label}. Aturan:`,
    ...typeRules(project).map((r) => `  - ${r}`),
    ...HOOK_RULES.map((r) => `  - ${r}`),
    t.needsSources ? '- Wajib fakta bersumber: cek dengan web search, minimal 2 sumber, cantumkan di catatan proyek.' : '',
    '- Bahasa video: Indonesia (narasi dan teks di layar). Cerita selesai tuntas, ditutup ucapan terima kasih sudah menonton.',
  ];
}

const VOICE_TWO = (project: Project, slug: string, dir: string) =>
  usesTwoVoices(project)
    ? `- Project ini **dua suara**: A = karakter utama milik pengguna (dibuat di Pengaturan > Karakter) yang berbicara sebagai dirinya, B = narator. Satu file per giliran dengan \`speaker: "A"\`/\`"B"\` (\`${slug}/${dir}/baris_XX.mp3\`), lalu gabungkan berurutan dengan ffmpeg.`
    : '- Satu suara (suara A): karakter utama milik pengguna sekaligus menjadi narator (bercerita sebagai dirinya).';

/** Brief untuk skill lemo-opuscar (LemoLab). Skill dan pustakanya dipakai utuh; brief menjawab "one round of questions". */
export function buildLemoBrief(project: Project, slug: string) {
  const st = visualStyle(project.visual_style);
  const lines = [
    `# Brief HyperForge: ${project.title}`,
    '',
    'Brief dari aplikasi HyperForge. Jalankan skill lemo-opuscar **persis seperti SKILL.md dan $LIB/AGENTS.md** (setup.sh, treatment, look, produksi, cek diri, serahkan). Brief ini menjawab putaran pertanyaan (Workflow langkah 1); tanyakan hanya yang belum terjawab.',
    '',
    '## Gaya & bentuk',
    `- Gaya pustaka: **${st.skillStyle}** (\`$LIB/styles/${st.skillStyle}/STYLE.md\`), sudah dipilih pengguna di HyperForge. Jangan tawarkan daftar gaya lagi.`,
    `- Rasio: ${project.format === '16:9' ? '16:9 (1920x1080)' : '9:16 (1080x1920, video tegak Shorts/TikTok/Reels)'}. Durasi: sekitar ${project.target_seconds} detik.`,
    '- Bahasa film: **Indonesia** (narasi + subtitle). Storyboard: tunjukkan dulu satu lembar frame kunci sebelum produksi penuh.',
    '- Teks di layar: subtitle narasi wajib terbaca (aturan HyperForge).',
    '',
    '## Isi',
    ...isiLines(project),
    '',
    '## Suara narasi: vibi.pro (pilihan pengguna)',
    `- Pengguna punya suara sendiri lewat **vibi.pro** (pengganti Kokoro/edge-tts di TECHNIQUE.md). Setelah naskah VO jadi: \`anima_vibi_tts\` dengan \`estimate: true\`, sebutkan suara + jumlah karakter, lalu buat \`${slug}/voice/vo.mp3\`. Ubah ke WAV bila pipeline butuh (\`ffmpeg -y -i ${slug}/voice/vo.mp3 -ar 24000 -ac 1 ${slug}/voice/vo.wav\`).`,
    `- Timing kata: \`anima_vibi_words\` -> \`${slug}/voice/words.json\` (format [{s, e, text}]); dipakai untuk subtitle dan sinkron gambar. Lewati asr_check.py bahasa Inggris.`,
    VOICE_TWO(project, slug, 'voice'),
    '- Musik & SFX: dari pustaka (sampler/synth) seperti biasa.',
    '',
    '## Folder & hasil',
    `- Folder proyek: \`${slug}/\` di folder kerja ini (bukan \`films/\`). Video akhir: \`${slug}/${slug}.mp4\` (atau di \`${slug}/out/\`); HyperForge mengambil MP4 dari folder proyek.`,
    '- Di Windows: python pustaka ada di `$LIB/.venv/bin/python` (sudah disiapkan HyperForge), `sh`/`bash` dari Git for Windows.',
    THUMB_RULE(slug),
  ];
  return lines.filter((l) => l !== '').join('\n') + '\n';
}

/** Brief untuk skill motionmaxxing (Tejash Makwana). */
export function buildMotionBrief(project: Project, slug: string) {
  const st = visualStyle(project.visual_style);
  const kinetic = st.skillStyle === 'kinetic';
  const lines = [
    `# Brief HyperForge: ${project.title}`,
    '',
    'Brief dari aplikasi HyperForge. Jalankan skill motionmaxxing **persis seperti SKILL.md** (toolbox & taste, brand, ide, world, build, render, gates G0-G5, NOTE.md). Tanyakan hanya yang belum terjawab di sini.',
    '',
    '## Jenis',
    kinetic
      ? '- **Kinetic typography**: kata-kata bergerak mengikuti ritme narasi (craft law 11), tetap satu ide dan satu dunia.'
      : '- **Promo / motion graphic** (peluncuran, fitur, brand sting, iklan sosial) sesuai topik.',
    `- Rasio: ${project.format === '16:9' ? '16:9 (1920x1080)' : '9:16 (1080x1920)'}. Durasi: sekitar ${project.target_seconds} detik.`,
    '- Kalau topik menyebut brand/website, tangkap brand-nya (references/brand.md). Kalau tidak ada brand, perlakukan topik/judul sebagai "brand" dan buat identitas orisinal.',
    '',
    '## Isi',
    ...isiLines(project),
    '',
    '## Suara: vibi.pro, bukan ElevenLabs langsung',
    `- Pengguna tidak memberi ELEVENLABS_API_KEY; suaranya lewat **vibi.pro** (alat MCP). Ganti \`voice.py vo\` dengan: \`anima_vibi_tts\` \`estimate: true\` -> sebutkan suara + karakter -> buat \`${slug}/audio/vo.mp3\`. Timing kata: \`anima_vibi_words\` -> \`${slug}/audio/words.json\`. \`voice.py split\` dan \`mix.py\` tetap dipakai seperti biasa.`,
    VOICE_TWO(project, slug, 'audio'),
    '- SFX & musik: tanpa key ElevenLabs, buat dari kode/synth atau tanpa musik (sound-sync.md bagian 9). Sebutkan satu baris ke pengguna, lalu lanjut.',
    '',
    '## Folder & hasil',
    `- Folder proyek: \`${slug}/\` (pengganti \`film/\` di SKILL.md). Hasil akhir \`${slug}/final.mp4\` + \`${slug}/NOTE.md\`; HyperForge mengambil MP4 dari folder proyek.`,
    '- Di Windows `python3` sudah diarahkan ke Python pengguna; skrip .sh dijalankan dengan `bash`. Chrome: env CHROME_PATH.',
    THUMB_RULE(slug),
  ];
  return lines.filter((l) => l !== '').join('\n') + '\n';
}

/** Brief untuk skill hyperforge-flow (Google Flow Veo + vibi.pro). */
export function buildFlowBrief(project: Project, slug: string) {
  const st = visualStyle(project.visual_style);
  const lines = [
    `# Brief HyperForge: ${project.title}`,
    '',
    'Brief dari aplikasi HyperForge. Jalankan skill hyperforge-flow (SKILL.md): naskah dari Claude, suara dari vibi.pro, Google Flow hanya untuk klip video + SFX, lalu rakit dengan tools/rakit.mjs.',
    '',
    '## Gaya & bentuk',
    `- Gaya visual klip: **${st.skillStyle}** (dipilih di HyperForge). Sebut gaya ini di setiap prompt Flow supaya semua klip seragam.`,
    st.skillNote ? `- ${st.skillNote}` : '',
    `- Rasio: ${project.format === '16:9' ? '16:9' : '9:16'}. Durasi video: sekitar ${project.target_seconds} detik (jumlah klip mengikuti narasi, 4-8 detik per shot).`,
    '- Subtitle per kata wajib (rakit.mjs, `subtitle: true`).',
    '',
    '## Isi',
    ...isiLines(project),
    '',
    '## Suara narasi: vibi.pro',
    `- \`anima_vibi_tts\` estimate dulu (sebutkan suara + karakter), lalu \`${slug}/audio/vo.mp3\`; timing kata \`anima_vibi_words\` -> \`${slug}/audio/words.json\`.`,
    VOICE_TWO(project, slug, 'audio'),
    '- Google Flow tidak dipakai untuk suara orang atau musik; hanya video + SFX.',
    '',
    '## Hasil',
    `- Folder proyek: \`${slug}/\`. Video akhir \`${slug}/hasil/${slug}.mp4\`; HyperForge mengambilnya dari \`${slug}/hasil/\`.`,
    THUMB_RULE(`${slug}/hasil`),
  ];
  return lines.filter((l) => l !== '').join('\n') + '\n';
}

/** Brief untuk skill kamal (HyperForge). */
export function buildKamalBrief(project: Project, slug: string) {
  const st = visualStyle(project.visual_style);
  const lines = [
    `# Brief HyperForge: ${project.title}`,
    '',
    'Brief dari aplikasi HyperForge. Jalankan skill kamal (SKILL.md): naskah -> suara -> storyboard -> render, dengan persetujuan pengguna di setiap tahap. Tanyakan hanya yang belum terjawab di sini.',
    '',
    '## Gaya & bentuk',
    `- Varian: **${st.skillStyle}** (styles/${st.skillStyle}.md, templates/${st.skillStyle}.html), sudah dipilih pengguna. Wajib memakai kit/kamal-kit.js.`,
    `- Format: ${project.format === '16:9' ? '16:9 (1920x1080; susun ulang komposisi untuk layar lebar)' : '9:16 (1080x1920)'}. Durasi: sekitar ${project.target_seconds} detik.`,
    '- Nama kanal di layar: tanyakan sekali ke pengguna (boleh kosong).',
    '',
    '## Isi',
    ...isiLines(project),
    '',
    '## Suara: vibi.pro',
    `- \`anima_vibi_tts\` estimate dulu (sebutkan suara + karakter), lalu \`${slug}/audio/vo.mp3\`; timing kata \`anima_vibi_words\` -> \`${slug}/audio/words.json\`.`,
    VOICE_TWO(project, slug, 'audio'),
    '',
    '## Hasil',
    `- Folder proyek: \`${slug}/\`. Video akhir di \`${slug}/hasil/\` (video_final.mp4); HyperForge mengambilnya dari sana.`,
    THUMB_RULE(`${slug}/hasil`),
  ];
  return lines.filter((l) => l !== '').join('\n') + '\n';
}

/** Brief untuk skill directing-stickman-videos (kaomei), mode B Autopilot (render lokal). */
export function buildStickmanBrief(project: Project, slug: string) {
  const st = visualStyle(project.visual_style);
  const portrait = project.format !== '16:9';
  const lines = [
    `# Brief HyperForge: ${project.title}`,
    '',
    `Brief dari aplikasi HyperForge. Jalankan skill directing-stickman-videos **mode B · Autopilot, style ${st.skillStyle}** persis seperti SKILL.md, references/autopilot.md, references/autopilot-runtime.md, references/autopilot-production-qa.md, dan reference style ${st.skillStyle}. Mode, style, rasio, durasi, dan bahasa sudah dijawab di sini; tanyakan hanya yang belum.`,
    '',
    '## Pengaturan',
    `- Mode **B Autopilot**, style **${st.skillStyle}** (\`"style": "${st.skillStyle}"\` di project.json).`,
    `- Rasio: ${portrait ? '9:16 (width 1080, height 1920; susun komposisi tegak, tinggi desain 1280 x 1920 / 1080)' : '16:9 (1280x720 atau 1920x1080)'}. Durasi: sekitar ${project.target_seconds} detik.`,
    '- Bahasa narasi & subtitle: **Indonesia** (font bawaan Caveat mendukung huruf Latin).',
    '',
    '## Isi',
    ...isiLines(project),
    '',
    '## Suara: vibi.pro (pengganti Gemini TTS)',
    '- Pengguna tidak memakai Gemini untuk suara. Provider suara = **vibi.pro** (suara pilihan pengguna di HyperForge); catat sebagai provider/voice di project. Jangan meminta API key.',
    `- \`anima_vibi_tts\` estimate dulu (sebutkan suara + karakter), lalu \`${slug}/narration.mp3\`. Timing kata: \`anima_vibi_words\` -> \`${slug}/words.json\`, lalu perintah \`captions\` skill (\`node <skill>/scripts/autopilot.mjs captions ${slug}/words.json ${slug}/captions.json\`; sesuaikan nama field kata bila perlu). Tidak perlu Whisper.`,
    VOICE_TWO(project, slug, 'voice'),
    '- Gambar: B1 memakai aset bawaan (`@b1/...`) dan pose atlas; B3 memakai lapisan vektor (path/rect/ellipse/group). Jangan memakai layanan gambar berbayar (Gemini) tanpa persetujuan pengguna.',
    '',
    '## Folder & hasil',
    `- Folder proyek: \`${slug}/\` di folder kerja ini (di luar folder skill). Skrip dijalankan dengan path skill: \`node <skill>/scripts/autopilot.mjs ...\` dan path absolut ke \`${slug}/project.json\`.`,
    `- Contoh ±20 detik dulu (preview), minta persetujuan, baru approve + render penuh. Video akhir di \`${slug}/output/\`; HyperForge mengambil MP4 dari sana.`,
    THUMB_RULE(`${slug}/output`),
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
      ? '- Gaya ini: pembawa **tokoh tetap Raka** (`XD.pembawa`, jangan dirancang ulang atau diubah; karakter HyperForge di bawah tidak dipakai sebagai pembawa). Tokoh & benda lain WAJIB dari pustaka `kit/explainer-datar.js` (XD), buat lembar tokoh & benda sebelum storyboard. Cerita selesai tuntas, ditutup ucapan terima kasih + sampai jumpa dengan kartu `XD.penutup` (tanpa teaser video berikutnya). Lihat styles/explainer-datar.md.'
      : '',
    '- **Thumbnail + judul hook wajib** setelah video disetujui (SKILL.md langkah 6.6): 5 pasangan judul + teks thumbnail untuk dipilih, `hasil/thumbnail.jpg` (+ `hasil/cover.jpg` untuk 9:16) dan `hasil/judul.txt`.',
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
      ? '- **Dua suara** (dipilih pengguna untuk project ini): A = karakter utama pengguna (yang ditandai utama di bawah) berbicara sebagai dirinya, B = narator. Satu file per giliran dengan `speaker: "A"`/`"B"`, lalu gabungkan. Saat minta persetujuan naskah, tandai tiap kalimat dengan A/B.'
      : '- Satu suara (suara A): karakter utama pengguna sekaligus menjadi narator.',
    '',
    '## Hasil',
    `- Folder proyek: \`${slug}/\`. Video akhir di \`${slug}/hasil/\` (video_final.mp4 + video_final_tanpa_musik.mp4); HyperForge mengambilnya dari sana.`,
  ];
  return lines.filter((l) => l !== '').join('\n') + '\n';
}
