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
      vibiVoices(opts: { provider: 'elevenlabs' | 'minimax' | 'capcut'; search?: string; indo?: boolean }): Promise<VibiVoice[]>;
      voiceStatus(slug: string): Promise<VoiceStatus>;
      generateVoice(payload: {
        slug: string;
        text: string;
        lines?: { speaker: string; text: string }[];
      }): Promise<{ mp3: string; words: number | null; credits: number | null; notes: string[] }>;
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
      generateWithClaude(payload: {
        projectId: string;
        prompt: string;
        /** style 2D: aplikasi menyiapkan potongan referensi gaya dulu */
        style?: string;
        session: { access_token: string; expires_at: number };
      }): Promise<{ ok: boolean; summary: string }>;
      cancelGenerate(): Promise<boolean>;
      onClaudeEvent(cb: (e: { projectId: string; line: string }) => void): () => void;
      generateCharacter(payload: {
        id: string;
        character: { name: string; nickname: string; is_main: boolean; personality: string; appearance: string; visual_style: string };
        feedback?: string;
        sessionId?: string;
      }): Promise<{ svg: string; sessionId?: string; problems?: string[] }>;
      cancelCharacter(): Promise<boolean>;
      onCharacterEvent(cb: (e: { id: string; line: string }) => void): () => void;
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
