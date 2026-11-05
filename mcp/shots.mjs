// Bagian server MCP yang murni (tanpa Supabase/jaringan): skema shot, hitungan durasi, dan pemeriksaan shot.
// Dipisah dari server.mjs supaya bisa dites (tests/shots.test.mjs).
import { z } from 'zod';

export const FPS = 30;
export const MAX_SHOTS = 120;

export const shotSchema = z.object({
  durationSeconds: z.number().min(0.5).max(60).describe('Durasi shot dalam detik (30 fps)'),
  camera: z.string().describe('Gerak/sudut kamera, mis. "dolly in", "close-up"'),
  characters: z.array(z.string()).default([]),
  narration: z.string().default('').describe('Kalimat narasi pada shot ini'),
  world: z
    .record(z.string(), z.unknown())
    .default({})
    .describe(
      'Style 3D: setting/props/cahaya bebas. Style 2D WAJIB: { bg: "<id latar>", camera: "static|zoom-in|zoom-out|pan-left|pan-right|shake|push-speaker", framing: "wide|medium|close", transition: "cut|fade|slide|zoom|flash|whip", cast: [{ char: "<key karakter>", x: 0..1, flip?: bool, expr?: "normal|senang|sedih|marah|kaget", pose?: "idle|point|wave|explain|shrug|cheer|think", enter?: "none|left|right|bottom|pop", toX?: 0..1 }], speaker: "<key karakter yang bicara>", props: [{ prop: "<id benda>", x: 0..1, y: 0..1, size: 0.05..1.2, anim?: "none|float|bob|pop|drop|slide-left|slide-right|across-left|across-right|spin|pulse|shake", delay?: detik, layer?: "back|front" }] }. cast boleh [] untuk shot sisipan (close-up benda/peta) asal ada props.',
    ),
  speaker: z.enum(['A', 'B', '']).default('').describe("Untuk project 2 suara (guide.twoSpeakers): 'A' = karakter utama pengguna, 'B' = narator (jenis Dialog: tokoh kedua). Siapa yang bicara di shot ini"),
});

/** Daftar shot untuk anima_save_story (1..120 shot). */
export const shotListSchema = z.array(shotSchema).min(1).max(MAX_SHOTS);

/** Detik -> frame (30 fps), dibulatkan ke frame terdekat. */
export const secondsToFrames = (sec) => Math.round(sec * FPS);

/** Shot dari Claude -> baris tabel shots. */
export function shotRows(projectId, shots) {
  return shots.map((s, i) => ({
    project_id: projectId,
    idx: i + 1,
    duration_frames: secondsToFrames(s.durationSeconds),
    camera: s.camera,
    characters: s.characters,
    narration_text: s.narration,
    world: s.world,
    speaker: s.speaker,
  }));
}

/** Total durasi (detik) dari baris shot. */
export const totalSeconds = (rows) => rows.reduce((n, r) => n + r.duration_frames, 0) / FPS;

/** Patch sebagian (anima_patch_shot) -> kolom yang diubah saja. */
export function patchRow(patch) {
  const row = {};
  if (patch.durationSeconds !== undefined) row.duration_frames = secondsToFrames(patch.durationSeconds);
  if (patch.camera !== undefined) row.camera = patch.camera;
  if (patch.characters !== undefined) row.characters = patch.characters;
  if (patch.narration !== undefined) row.narration_text = patch.narration;
  if (patch.world !== undefined) row.world = patch.world;
  if (patch.speaker !== undefined) row.speaker = patch.speaker;
  return row;
}

/** Project 2 suara: setiap shot wajib A/B dan minimal satu shot B. Mengembalikan pesan salah atau null. */
export function speakerProblem(shots) {
  const bad = shots.findIndex((s) => s.speaker !== 'A' && s.speaker !== 'B');
  if (bad >= 0) return `Project ini memakai 2 suara: wajib isi speaker 'A' atau 'B' di setiap shot (shot ${bad + 1} kosong).`;
  if (!shots.some((s) => s.speaker === 'B')) return `Project ini memakai 2 suara: belum ada shot dengan speaker 'B'.`;
  return null;
}

/**
 * Style 2D: latar/benda/karakter harus sudah ada, setiap shot punya isi, cukup benda cerita, dan tidak monoton.
 * Mengembalikan pesan salah (untuk Claude) atau null.
 */
export function check2dShots(shots, { bgs, propIds, keys }) {
  let withProps = 0;
  for (const [i, sh] of shots.entries()) {
    const w = sh.world || {};
    if (!w.bg || !bgs.includes(w.bg)) return `Shot ${i + 1}: world.bg "${w.bg ?? ''}" belum digambar. Latar yang ada: ${bgs.join(', ') || '(belum ada)'}. Gambar dulu dengan anima_save_background.`;
    const cast = Array.isArray(w.cast) ? w.cast : [];
    const props = Array.isArray(w.props) ? w.props : [];
    const badProp = props.find((x) => !propIds.includes(x?.prop));
    if (badProp) return `Shot ${i + 1}: benda "${badProp?.prop}" belum digambar. Benda yang ada: ${propIds.join(', ') || '(belum ada)'}. Gambar dulu dengan anima_save_prop.`;
    if (props.length) withProps++;
    if (!cast.length && !props.length) return `Shot ${i + 1}: cast dan props kosong. Isi karakter dari daftar (${keys.join(', ')}) atau jadikan shot sisipan dengan props.`;
    const bad = cast.find((m) => !keys.includes(m?.char));
    if (bad) return `Shot ${i + 1}: karakter "${bad?.char}" tidak ada. Pakai key: ${keys.join(', ')}.`;
  }
  if (shots.length >= 4 && withProps < Math.ceil(shots.length / 3)) {
    return `Baru ${withProps} dari ${shots.length} shot yang punya benda cerita (props). Minimal ${Math.ceil(shots.length / 3)}: gambar benda/kendaraan/dokumen/angka yang disebut narasi dengan anima_save_prop, taruh di shot yang menyebutnya (atau buat shot sisipan), lalu simpan ulang.`;
  }
  // Hindari monoton: latar + karakter + pose sama tiga shot berturut-turut tanpa benda.
  const sig = (k) => {
    const w = shots[k].world || {};
    return `${w.bg}|${(w.cast || []).map((m) => `${m.char}:${m.pose || 'idle'}`).join(',')}|${(w.props || []).length}`;
  };
  for (let i = 2; i < shots.length; i++) {
    if (sig(i) === sig(i - 1) && sig(i) === sig(i - 2) && !(shots[i].world?.props || []).length) {
      return `Shot ${i - 1}-${i + 1} sama persis (latar, karakter, pose, tanpa benda). Variasikan: ganti pose/framing, tambahkan benda yang disebut narasi, atau pindah latar.`;
    }
  }
  return null;
}
