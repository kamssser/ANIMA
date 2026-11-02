import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Clapperboard, FolderKanban, LayoutDashboard, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { sb } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Project', icon: FolderKanban, end: false },
  { to: '/renders', label: 'Antrean Render', icon: Clapperboard, end: false },
  { to: '/settings', label: 'Pengaturan', icon: SettingsIcon, end: false },
];

export function Layout({ email, children }: { email: string; children: ReactNode }) {
  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="grid size-7 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">A</div>
          <span className="font-semibold">ANIMA Studio</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground',
                  isActive && 'bg-accent font-medium text-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="truncate text-xs text-muted-foreground" title={email}>
            {email}
          </div>
          <button
            className="mt-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => sb().auth.signOut()}
          >
            <LogOut className="size-3.5" /> Keluar
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
