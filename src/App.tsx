import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { Toaster } from 'sonner';
import { initSupabase } from '@/lib/supabase';
import { markOrphanJobs } from '@/lib/api';
import { wireRenderEvents } from '@/lib/render';
import { wireTaskEvents } from '@/lib/tasks';
import { wireSkillChat } from '@/lib/skillchat';
import type { Settings } from '@/lib/types';
import { Layout } from '@/components/layout';
import { Skeleton } from '@/components/ui/misc';

// Tiap halaman dimuat saat dibuka saja, supaya start aplikasi ringan.
const OverviewPage = lazy(() => import('@/pages/overview'));
const ProjectsPage = lazy(() => import('@/pages/projects'));
const ProjectDetailPage = lazy(() => import('@/pages/project-detail'));
const RendersPage = lazy(() => import('@/pages/renders'));
const LibraryPage = lazy(() => import('@/pages/library'));
const SettingsPage = lazy(() => import('@/pages/settings'));
// Hanya tampil sebelum masuk: tidak perlu ikut bundle utama.
const SetupPage = lazy(() => import('@/pages/setup').then((m) => ({ default: m.SetupPage })));
const LoginPage = lazy(() => import('@/pages/login').then((m) => ({ default: m.LoginPage })));

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    window.anima.getSettings().then(setSettings);
  }, []);

  const configured = Boolean(settings?.supabaseUrl && settings?.supabaseAnonKey);

  useEffect(() => {
    if (!settings || !configured) return;
    const client = initSupabase(settings.supabaseUrl, settings.supabaseAnonKey);
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [settings, configured]);

  useEffect(() => {
    if (!session) return;
    wireRenderEvents();
    wireTaskEvents();
    wireSkillChat();
    window.anima
      .activeRenders()
      .then((a) => markOrphanJobs([...(a.current ? [a.current] : []), ...a.queued]))
      .catch(() => {});
  }, [session]);

  const toaster = <Toaster richColors position="bottom-right" />;

  if (!settings) return null;
  if (!configured) {
    return (
      <>
        <Suspense fallback={null}>
          <SetupPage onSaved={setSettings} />
        </Suspense>
        {toaster}
      </>
    );
  }
  if (session === undefined) return null;
  if (!session) {
    return (
      <>
        <Suspense fallback={null}>
          <LoginPage onResetConfig={() => window.anima.saveSettings({ supabaseUrl: '', supabaseAnonKey: '' }).then(setSettings)} />
        </Suspense>
        {toaster}
      </>
    );
  }

  return (
    <HashRouter>
      <Layout email={session.user.email ?? ''}>
        <Suspense fallback={<Skeleton className="m-6 h-40" />}>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/renders" element={<RendersPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/settings" element={<SettingsPage onSaved={setSettings} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
      {toaster}
    </HashRouter>
  );
}
