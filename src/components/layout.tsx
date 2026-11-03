import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Clapperboard, FolderKanban, LayoutDashboard, Loader2, LogOut, Settings as SettingsIcon } from 'lucide-react';
import logo from '@/assets/logo.png';
import { SidebarUpdate, UpdateBanner, UpdateDialog } from '@/components/update';
import { sb } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { setValue, useRunningTasks } from '@/lib/tasks';

const groups = [
  {
    label: 'Produksi',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/projects', label: 'Project', icon: FolderKanban, end: false },
      { to: '/renders', label: 'Antrean Render', icon: Clapperboard, end: false },
    ],
  },
  {
    label: 'Sistem',
    items: [{ to: '/settings', label: 'Pengaturan', icon: SettingsIcon, end: false }],
  },
];

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return <img src={logo} alt="HyperForge" width={size} height={size} className={cn('select-none', className)} draggable={false} />;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-extrabold tracking-tight', className)}>
      Hyper<span className="text-primary">Forge</span>
    </span>
  );
}

export function Layout({ email, children }: { email: string; children: ReactNode }) {
  return (
    <div className="flex h-full bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-3 px-5">
          <BrandMark size={34} className="rounded-lg" />
          <Wordmark className="text-[17px] text-foreground" />
        </div>

        <nav className="flex flex-1 flex-col gap-6 px-3 pt-4">
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col gap-1">
              <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">{g.label}</div>
              {g.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-accent/60 hover:text-foreground',
                      isActive && 'bg-primary/15 font-medium text-foreground ring-1 ring-primary/30 ring-inset',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn('size-[18px]', isActive ? 'text-primary' : 'text-muted-foreground')} />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <RunningTasks />
        <SidebarUpdate />
        <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl border border-sidebar-border bg-card/60 p-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground uppercase">
            {email.slice(0, 1) || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-foreground" title={email}>
              {email}
            </div>
            <button className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => sb().auth.signOut({ scope: 'local' })}>
              <LogOut className="size-3" /> Keluar
            </button>
          </div>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <UpdateBanner />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </main>
      <UpdateDialog />
    </div>
  );
}

/** Proses yang masih berjalan di latar (tetap jalan walau pindah halaman). Klik untuk kembali ke halamannya. */
function RunningTasks() {
  const running = useRunningTasks();
  const navigate = useNavigate();
  if (!running.length) return null;
  return (
    <div className="mx-3 mb-2 flex flex-col gap-1">
      <div className="px-1 pb-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">Sedang berjalan</div>
      {running.map(([key, t]) => (
        <button
          key={key}
          title={`${t.label}: ${t.step}`}
          onClick={() => {
            // Proses dari Pengaturan: buka bagian yang memulainya.
            if (key === 'character') setValue('settings:section', 'characters');
            else if (key === 'setup') setValue('settings:section', 'remotion');
            else if (key === 'bench') setValue('settings:section', 'render');
            else if (key === 'python') setValue('settings:section', 'audio');
            else if (key.startsWith('voice:') || key.startsWith('claude:')) {
              const id = t.href.split('/').pop();
              setValue(`project-tab:${id}`, key.startsWith('voice:') ? 'render' : 'brief');
            }
            navigate(t.href);
          }}
          className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-2 text-left hover:bg-primary/20"
        >
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" />
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-foreground">{t.label}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{t.step}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Header halaman: tetap terlihat saat konten di-scroll. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="sticky top-0 z-20 border-b bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-8 py-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-1 truncate text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Isi halaman dengan lebar maksimum supaya rapi di layar lebar. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto flex max-w-6xl flex-col gap-6 px-8 py-6', className)}>{children}</div>;
}

/** Kerangka layar login/setup: hitam dengan cahaya biru, logo di atas kartu. */
export function BrandScreen({ children }: { children: ReactNode }) {
  return (
    <div className="brand-screen dark grid min-h-full place-items-center p-6 text-foreground">
      <div className="flex w-full max-w-md flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-4">
          <BrandMark size={104} className="drop-shadow-[0_12px_40px_rgba(47,107,255,0.45)]" />
          <div className="text-center">
            <Wordmark className="text-3xl text-white" />
            <p className="mt-1 text-sm text-white/55">Studio video pendek 3D bertenaga Claude</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
