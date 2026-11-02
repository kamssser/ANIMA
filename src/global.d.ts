import type { ClaudeDetect, RenderEvent, RenderRequest, Settings, SystemInfo } from '@/lib/types';

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
