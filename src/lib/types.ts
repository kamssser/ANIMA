export type ProjectStatus = 'draft' | 'ready' | 'rendering' | 'done';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface Project {
  id: string;
  title: string;
  topic: string;
  target_seconds: number;
  style_preset: string;
  composition: string;
  script: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  /** Jenis konten (shared/content-types.json). Kosong di database lama sebelum migrasi 002. */
  content_type?: string;
  hook?: string;
  sources?: { title: string; url: string }[];
  /** Style visual (shared/visual-styles.json). Kosong di database sebelum migrasi 003. */
  visual_style?: string;
  format?: '9:16' | '16:9';
  assets?: ProjectAssets;
}

export interface ProjectAssets {
  backgrounds?: Record<string, { description: string; svg: string }>;
  /** benda cerita (kereta, peta, ayam...) */
  props?: Record<string, { description: string; svg: string }>;
  references?: { title: string; url: string; image: string; license?: string }[];
  /** Jumlah suara project (1 narator / 2 = suara A & B). Kosong = bawaan jenis konten. */
  voices?: 1 | 2;
}

export interface Character {
  id: string;
  /** kunci pendek unik (huruf kecil), dipakai shot: cast[].char */
  key: string;
  name: string;
  nickname: string;
  is_main: boolean;
  personality: string;
  appearance: string;
  visual_style: string;
  svg: string;
  version: number;
  updated_at: string;
}

/** Penataan 2D satu shot, disimpan di shots.world. */
export type PropPlacement = {
  prop: string;
  x: number;
  y: number;
  size: number;
  anim?: string;
  delay?: number;
  layer?: 'back' | 'front';
  flip?: boolean;
};

export interface Stage2D {
  bg?: string;
  camera?: 'static' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'shake' | 'push-speaker';
  cast?: { char: string; x: number; scale?: number; flip?: boolean; expr?: string; pose?: string; enter?: string; toX?: number }[];
  framing?: 'wide' | 'medium' | 'close';
  speaker?: string;
  transition?: 'cut' | 'fade' | 'slide' | 'zoom' | 'flash' | 'whip';
  props?: PropPlacement[];
}

export interface Shot {
  id: string;
  project_id: string;
  idx: number;
  duration_frames: number;
  camera: string;
  characters: string[];
  world: Record<string, unknown>;
  narration_text: string;
  notes: string;
  /** 'A' | 'B' untuk project 2 suara; '' untuk satu narator. */
  speaker?: string;
}

export interface RenderJob {
  id: string;
  project_id: string;
  status: JobStatus;
  progress: number;
  output_path: string | null;
  error: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  projects?: { title: string } | null;
}

export interface Settings {
  supabaseUrl: string;
  supabaseAnonKey: string;
  remotionProjectPath: string;
  remotionEntry: string;
  defaultComposition: string;
  outputDir: string;
  tempDir: string;
  scale: number;
  concurrency: number;
  crf: number;
  vibiApiKey: string;
  vibiProvider: 'elevenlabs' | 'minimax' | 'capcut';
  vibiModel: string;
  vibiVoiceId: string;
  vibiVoiceName: string;
  vibiLanguage: string;
  vibiSpeed: number;
  /** Suara B (pembicara kedua, project 2 suara). Provider selalu sama dengan suara A; model/suara berbeda. */
  vibi2Provider: 'elevenlabs' | 'minimax' | 'capcut';
  vibi2Model: string;
  vibi2VoiceId: string;
  vibi2VoiceName: string;
  vibi2Language: string;
  vibi2Speed: number;
  wordTimestamps: boolean;
  voiceDir: string;
  audioDir: string;
  pythonPath: string;
  runMix: boolean;
  muxAudio: boolean;
  frameTimeoutMs: number;
  renderQuality: 'full' | 'draft';
  gl: 'angle' | 'swiftshader';
  benchFrame: number;
}

export interface UpdateState {
  state: 'idle' | 'dev' | 'checking' | 'latest' | 'downloading' | 'ready' | 'error';
  version?: string;
  percent?: number;
  error?: string | null;
  message?: string;
  checkedAt?: string;
  current?: string;
  /** Catatan update (dari CHANGELOG.md lewat GitHub Releases). */
  notes?: string;
}

export interface BenchResult {
  id: string;
  kind: 'still' | 'speed';
  date: string;
  composition: string;
  frame: number;
  frames: number;
  width: number;
  height: number;
  quality: 'full' | 'draft';
  /** Kosong untuk hasil uji versi lama (sebelum 0.4.1, selalu CPU). */
  gl?: 'angle' | 'swiftshader';
  concurrency: number;
  seconds: number;
  secPerFrame: number;
  estVideoHours: number | null;
  file: string;
  preview?: string | null;
}

export interface VibiVoice {
  id: string;
  name: string;
  description?: string;
  gender?: string;
  accent?: string;
  preview?: string | null;
}

export interface VoiceStatus {
  mp3: string | null;
  words: number | null;
  updatedAt: string | null;
  /** teks yang dipakai saat suara dibuat (lihat voiceTextKey); null untuk suara lama */
  textKey: string | null;
  wordsEditedAt: string | null;
}

export type Word = { s: number; e: number; text: string };

export type QaIssue = { level: 'error' | 'warn'; kind: string; at?: number; text: string };
export type QaSummary = { ok: boolean; errors: number; warnings: number };
export interface QaReport {
  ok: boolean;
  checkedAt: string;
  duration: number;
  width: number;
  height: number;
  lufs: number | null;
  peak: number | null;
  issues: QaIssue[];
  /** data URL JPEG */
  sheet: string | null;
  sheetStep?: number;
  sheetCols?: number;
}

export type PythonCheck = { ok: boolean; python: string | null; numpy?: string; scipy?: string; error?: string };

export interface SystemInfo {
  cpu: string;
  threads: number;
  ramGb: number;
  freeRamGb: number;
  tempFreeGb: number | null;
  outputFreeGb: number | null;
  remotionFound: boolean;
  version: string;
}

export interface ClaudeDetect {
  node: string | null;
  code: { installed: boolean; path: string | null; version: string | null; connected: boolean };
  desktop: { installed: boolean; configPaths: string[]; connected: boolean };
  sessionSaved: boolean;
}

export type RenderEvent =
  | { jobId: string; type: 'queued'; position: number }
  | { jobId: string; type: 'started'; outFile: string }
  | { jobId: string; type: 'progress'; progress: number; stage: string }
  | { jobId: string; type: 'done'; outFile: string; warning?: string; qa?: QaSummary }
  | { jobId: string; type: 'failed'; error: string }
  | { jobId: string; type: 'cancelled' };

export interface RenderRequest {
  jobId: string;
  /** '3d' = komposisi pengguna + lapisan teks; '2d' = mesin AnimaComic2D */
  kind: '3d' | '2d';
  /** folder suara project (outputDir/<slug>) untuk timing kata + audio */
  slug: string;
  composition: string;
  fileName: string;
  props: RenderProps;
  /** 3D: teks wajib per shot */
  overlay?: { shots: { durationInFrames: number; text: string }[]; look: string };
  /** 2D: data video lengkap (tanpa words; ditambah aplikasi dari words.json) */
  comic?: Comic2DRequest;
}

export interface Comic2DRequest {
  style: string;
  format: '9:16' | '16:9';
  characters: Record<string, { name: string; svg: string }>;
  backgrounds: Record<string, { svg: string }>;
  props: Record<string, { svg: string }>;
  shots: {
    durationInFrames: number;
    bg: string;
    transition?: Stage2D['transition'];
    props?: PropPlacement[];
    camera?: Stage2D['camera'];
    framing?: 'wide' | 'medium' | 'close';
    cast: NonNullable<Stage2D['cast']>;
    speaker?: string;
    text: string;
  }[];
  watermark?: string;
}

/** Data yang diterima komposisi Remotion lewat --props (baca dengan getInputProps()). */
export interface RenderProps {
  title: string;
  topic: string;
  script: string;
  fps: number;
  durationInFrames: number;
  shots: {
    idx: number;
    durationInFrames: number;
    camera: string;
    characters: string[];
    world: Record<string, unknown>;
    narration: string;
    /** 'A' | 'B' untuk dialog/film, '' untuk satu narator. */
    speaker: string;
  }[];
}

/** Mesin style dari skill Claude pihak ketiga. */
export type SkillEngine = 'animate' | 'bang-motion' | 'studio' | 'animantra';

/** Kebutuhan satu mesin skill (Pengaturan > Skill video). */
export interface SkillCheck {
  engine: SkillEngine;
  ready: boolean;
  items: { id: string; label: string; ok: boolean; optional?: boolean; detail?: string }[];
  workDir: string;
  commit: string;
  url: string;
  optionalLabel: string;
}

/** Satu pesan di panel obrolan skill (lihat electron/skillchat.cjs). */
export interface ChatMessage {
  id: string;
  at: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  text: string;
  question?: { pertanyaan: string; pilihan: string[]; multi: boolean } | null;
  images?: string[];
  videos?: string[];
  error?: boolean;
}
