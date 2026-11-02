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
}

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
  | { jobId: string; type: 'done'; outFile: string }
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
