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
  wordTimestamps: boolean;
  voiceDir: string;
  audioDir: string;
  pythonPath: string;
  runMix: boolean;
  muxAudio: boolean;
  frameTimeoutMs: number;
  renderQuality: 'full' | 'draft';
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
  preview?: string;
}

export interface VoiceStatus {
  mp3: string | null;
  words: number | null;
  updatedAt: string | null;
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
  | { jobId: string; type: 'done'; outFile: string; warning?: string }
  | { jobId: string; type: 'failed'; error: string }
  | { jobId: string; type: 'cancelled' };

export interface RenderRequest {
  jobId: string;
  composition: string;
  fileName: string;
  props: RenderProps;
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
  }[];
}
