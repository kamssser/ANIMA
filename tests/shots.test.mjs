// Validasi shot + hitungan durasi di server MCP (mcp/shots.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FPS, MAX_SHOTS, shotSchema, shotListSchema, secondsToFrames, shotRows, totalSeconds, patchRow, speakerProblem, check2dShots } from '../mcp/shots.mjs';

const shot = (o = {}) => ({ durationSeconds: 5, camera: 'static', ...o });

test('shotSchema: isian minimal diberi bawaan', () => {
  const s = shotSchema.parse(shot());
  assert.deepEqual(s, { durationSeconds: 5, camera: 'static', characters: [], narration: '', world: {}, speaker: '' });
});

test('shotSchema: durasi 0.5-60 detik', () => {
  assert.ok(shotSchema.safeParse(shot({ durationSeconds: 0.5 })).success);
  assert.ok(shotSchema.safeParse(shot({ durationSeconds: 60 })).success);
  assert.ok(!shotSchema.safeParse(shot({ durationSeconds: 0.4 })).success);
  assert.ok(!shotSchema.safeParse(shot({ durationSeconds: 61 })).success);
  assert.ok(!shotSchema.safeParse(shot({ durationSeconds: '5' })).success);
});

test('shotSchema: speaker hanya A, B, atau kosong; camera wajib', () => {
  assert.ok(shotSchema.safeParse(shot({ speaker: 'A' })).success);
  assert.ok(!shotSchema.safeParse(shot({ speaker: 'C' })).success);
  assert.ok(!shotSchema.safeParse({ durationSeconds: 5 }).success);
});

test('shotListSchema: 1 sampai 120 shot', () => {
  assert.ok(!shotListSchema.safeParse([]).success);
  assert.ok(shotListSchema.safeParse([shot()]).success);
  assert.ok(shotListSchema.safeParse(Array.from({ length: MAX_SHOTS }, () => shot())).success);
  assert.ok(!shotListSchema.safeParse(Array.from({ length: MAX_SHOTS + 1 }, () => shot())).success);
});

test('durasi: detik -> frame 30 fps, dibulatkan', () => {
  assert.equal(FPS, 30);
  assert.equal(secondsToFrames(5), 150);
  assert.equal(secondsToFrames(0.5), 15);
  assert.equal(secondsToFrames(2.34), 70);
  assert.equal(secondsToFrames(60), 1800);
});

test('shotRows + totalSeconds: urutan idx dan total durasi', () => {
  const shots = shotListSchema.parse([shot({ durationSeconds: 2.5, narration: 'a' }), shot({ durationSeconds: 4, speaker: 'B' })]);
  const rows = shotRows('p1', shots);
  assert.deepEqual(
    rows.map((r) => [r.project_id, r.idx, r.duration_frames, r.narration_text, r.speaker]),
    [
      ['p1', 1, 75, 'a', ''],
      ['p1', 2, 120, '', 'B'],
    ],
  );
  assert.equal(totalSeconds(rows), 6.5);
});

test('patchRow: hanya kolom yang dikirim', () => {
  assert.deepEqual(patchRow({}), {});
  assert.deepEqual(patchRow({ durationSeconds: 3, narration: 'x' }), { duration_frames: 90, narration_text: 'x' });
});

test('speakerProblem: 2 suara wajib A/B dan ada B', () => {
  assert.match(speakerProblem([{ speaker: 'A' }, { speaker: '' }]), /shot 2 kosong/);
  assert.match(speakerProblem([{ speaker: 'A' }]), /belum ada shot dengan speaker 'B'/);
  assert.equal(speakerProblem([{ speaker: 'A' }, { speaker: 'B' }]), null);
});

test('check2dShots: latar, benda, karakter, dan variasi', () => {
  const ctx = { bgs: ['kota'], propIds: ['kereta'], keys: ['raka'] };
  const w = (o) => ({ world: { bg: 'kota', cast: [{ char: 'raka' }], ...o } });
  assert.equal(check2dShots([w({})], ctx), null);
  assert.match(check2dShots([w({ bg: 'hutan' })], ctx), /world.bg "hutan" belum digambar/);
  assert.match(check2dShots([w({ props: [{ prop: 'kapal' }] })], ctx), /benda "kapal" belum digambar/);
  assert.match(check2dShots([w({ cast: [] })], ctx), /cast dan props kosong/);
  assert.match(check2dShots([w({ cast: [{ char: 'tora' }] })], ctx), /karakter "tora" tidak ada/);
  // 4 shot tanpa benda: kurang benda cerita
  assert.match(check2dShots([w({}), w({}), w({}), w({})], ctx), /Baru 0 dari 4 shot/);
  // 3 shot sama persis berturut-turut (cukup benda di shot lain)
  const p = { props: [{ prop: 'kereta' }] };
  const same = [w(p), w(p), w({}), w({}), w({}), w(p)];
  assert.match(check2dShots(same, ctx), /Shot 3-5 sama persis/);
});
