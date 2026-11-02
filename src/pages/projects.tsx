import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout';
import { ProjectBadge } from '@/components/status';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Card, CardContent, Label, Skeleton, TBody, TD, TH, THead, TR, Table } from '@/components/ui/misc';
import { createProject, listProjects } from '@/lib/api';
import type { Project } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((e) => {
        toast.error(e.message);
        setProjects([]);
      });
  }, []);

  const shown = projects?.filter((p) => `${p.title} ${p.topic}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <PageHeader title="Project" description="Satu project = satu video pendek." actions={<NewProjectDialog />} />
      <div className="flex flex-col gap-4 p-6">
        <Input placeholder="Cari judul atau topik..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        <Card>
          <CardContent className="p-0">
            {!shown ? (
              <Skeleton className="m-5 h-24" />
            ) : shown.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Belum ada project. Klik "Project baru" untuk mulai.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Judul</TH>
                    <TH>Topik</TH>
                    <TH>Durasi target</TH>
                    <TH>Status</TH>
                    <TH>Diubah</TH>
                  </TR>
                </THead>
                <TBody>
                  {shown.map((p) => (
                    <TR key={p.id}>
                      <TD className="font-medium">
                        <Link to={`/projects/${p.id}`} className="hover:underline">
                          {p.title}
                        </Link>
                      </TD>
                      <TD className="max-w-xs truncate text-muted-foreground">{p.topic || '-'}</TD>
                      <TD className="tabular-nums">{p.target_seconds} dtk</TD>
                      <TD>
                        <ProjectBadge status={p.status} />
                      </TD>
                      <TD className="text-muted-foreground">{formatDate(p.updated_at)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function NewProjectDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await createProject({ title: title.trim(), topic: topic.trim(), target_seconds: seconds });
      setOpen(false);
      navigate(`/projects/${p.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Project baru
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Project baru</DialogTitle>
            <DialogDescription>Isi brief singkat. Script dan shot bisa dibuat Claude atau diketik manual.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="title">Judul</Label>
            <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Bridge That Fell for a Song" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="topic">Topik / ide cerita</Label>
            <Textarea id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Jembatan tua yang jatuh cinta pada lagu pengamen..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sec">Durasi target: {seconds} detik</Label>
            <input id="sec" type="range" min={30} max={90} step={5} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="accent-primary" />
            <span className="text-xs text-muted-foreground">Skill cartoon-3d-short ideal di 55 sampai 70 detik.</span>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy ? 'Membuat...' : 'Buat project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
