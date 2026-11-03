// Penyimpanan obrolan skill di sisi tampilan: tetap ada walau pindah halaman (proses Claude berjalan di proses utama).
import { getValue, setValue } from './tasks';
import type { ChatMessage, SkillEngine } from './types';

export type ChatState = { loaded: boolean; messages: ChatMessage[]; running: boolean; hasSession: boolean; activity?: { text: string; at: number } };
export const chatKey = (engine: SkillEngine, slug: string) => `skillchat:${engine}:${slug}`;
const EMPTY: ChatState = { loaded: false, messages: [], running: false, hasSession: false };

export function chatState(engine: SkillEngine, slug: string): ChatState {
  return getValue(chatKey(engine, slug), EMPTY);
}

export async function loadChat(engine: SkillEngine, slug: string) {
  const r = await window.anima.skillChatHistory({ engine, slug });
  setValue(chatKey(engine, slug), { loaded: true, ...r });
}

let wired = false;
/** Event dari proses utama, dipasang sekali untuk seluruh aplikasi. */
export function wireSkillChat() {
  if (wired) return;
  wired = true;
  window.anima.onSkillChatEvent((e) => {
    const key = chatKey(e.engine, e.slug);
    setValue<ChatState>(
      key,
      (s) =>
        e.type === 'message'
          ? { ...s, messages: [...s.messages, e.message], hasSession: true, activity: { text: e.message.role === 'tool' ? e.message.text : 'Menulis balasan...', at: Date.now() } }
          : e.type === 'activity'
            ? { ...s, activity: { text: e.text, at: e.at } }
            : { ...s, running: e.running, activity: e.running ? { text: 'Memulai Claude...', at: Date.now() } : undefined },
      EMPTY,
    );
  });
}
