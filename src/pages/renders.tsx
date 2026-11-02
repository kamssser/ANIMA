import { useCallback, useEffect, useState } from 'react';
import { PageBody, PageHeader } from '@/components/layout';
import { JobTable } from '@/components/job-table';
import { Card, CardContent, Skeleton } from '@/components/ui/misc';
import { listJobs } from '@/lib/api';
import { onRender } from '@/lib/render';
import type { RenderJob } from '@/lib/types';

export default function RendersPage() {
  const [jobs, setJobs] = useState<RenderJob[] | null>(null);
  const load = useCallback(() => listJobs().then(setJobs).catch(() => setJobs([])), []);

  useEffect(() => {
    load();
    return onRender((e) => {
      if (e.type === 'progress') {
        setJobs((js) => js?.map((j) => (j.id === e.jobId ? { ...j, progress: e.progress, status: 'running' } : j)) ?? js);
      } else {
        setTimeout(load, 500);
      }
    });
  }, [load]);

  return (
    <>
      <PageHeader title="Antrean Render" description="Render berjalan satu per satu di laptop ini. Aplikasi boleh diperkecil, tapi jangan ditutup." />
      <PageBody>
        <Card>
          <CardContent className="p-0">{jobs ? <JobTable jobs={jobs} showProject onChanged={load} /> : <Skeleton className="m-5 h-24" />}</CardContent>
        </Card>
      </PageBody>
    </>
  );
}
