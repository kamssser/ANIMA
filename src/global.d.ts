import type {
  BenchResult,
  ClaudeDetect,
  PythonCheck,
  RenderEvent,
  RenderRequest,
  Settings,
  SystemInfo,
  UpdateState,
  VibiVoice,
  VoiceStatus,
} from '@/lib/types';

declare global {
  interface Window {
    anima: {
      getSettings(): Promise<Settings>;
      saveSettings(next: Partial<Settings>): Promise<Settings>;
      pickFolder(title: string): Promise<string | null>;
      systemInfo(): Promise<SystemInfo>;
      startRender(job: RenderRequest): Promise<boolean>;
      cancelRender(jobId: string): Promise<boolean>;
      activeRenders(): Promise<{ current: string | null; queued: string[] }>;
      onRenderEvent(cb: (e: RenderEvent) => void): () => void;
      vibiVoices(search?: string): Promise<VibiVoice[]>;
      voiceStatus(slug: string): Promise<VoiceStatus>;
      generateVoice(payload: { slug: string; text: string }): Promise<{ mp3: string; words: number | null; credits: number | null; notes: string[] }>;
      onVoiceEvent(cb: (e: { slug: string; step: string; progress: number }) => void): () => void;
      updateState(): Promise<UpdateState>;
      checkUpdate(): Promise<UpdateState>;
      installUpdate(): Promise<void>;
      onUpdateEvent(cb: (e: UpdateState) => void): () => void;
      setupRemotion(): Promise<{ path: string }>;
      onSetupEvent(cb: (e: { step: string | null; line?: string }) => void): () => void;
      benchAuto(): Promise<{ results: BenchResult[]; best: number; candidates: number[]; threads: number; ramGb: number }>;
      benchList(): Promise<BenchResult[]>;
      benchRun(kind: 'still' | 'speed'): Promise<BenchResult>;
      benchCancel(): Promise<boolean>;
      onBenchEvent(cb: (e: { step: string; progress: number }) => void): () => void;
      pythonCheck(): Promise<PythonCheck>;
      pythonInstall(): Promise<{ ok: boolean; log: string }>;
      detectClaude(): Promise<ClaudeDetect>;
      installClaude(payload: {
        session: { access_token: string; refresh_token: string; expires_at: number };
        targets: ('code' | 'desktop')[];
      }): Promise<{ ok: boolean; message: string }>;
      removeClaude(): Promise<{ ok: boolean; message: string }>;
      openPath(p: string): Promise<string>;
      showItem(p: string): Promise<void>;
      openExternal(url: string): Promise<void>;
    };
  }
}

export {};
