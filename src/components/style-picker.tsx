// Pemilih style video: kartu bergambar per kelompok (2D cepat, Studio, Animate, Bang Motion, Kartun 3D).
import { useState } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/misc';
import { STYLE_GROUPS, VISUAL_STYLES, styleGroup, styleImage, styleSpeed, visualStyle, type StyleGroup, type VisualStyleId } from '@/lib/styles';
import { cn } from '@/lib/utils';

export function StylePicker({ value, onChange }: { value: string; onChange: (id: VisualStyleId) => void }) {
  const current = visualStyle(value);
  const [group, setGroup] = useState<StyleGroup>(styleGroup(current));
  const list = VISUAL_STYLES.filter((s) => styleGroup(s) === group);
  const info = STYLE_GROUPS.find((g) => g.id === group);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5">
        {STYLE_GROUPS.map((g) => {
          const n = VISUAL_STYLES.filter((s) => styleGroup(s) === g.id).length;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', group === g.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/60')}
            >
              {g.label} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>
      {info && <p className="-mt-1 text-xs text-muted-foreground">{info.hint}</p>}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {list.map((s) => {
          const img = styleImage(s.id);
          const on = current.id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              title={s.description}
              className={cn(
                'group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg',
                on && 'border-primary ring-2 ring-primary/50',
              )}
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
                {img ? <img src={img} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" /> : null}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
                <Badge variant="secondary" className="absolute bottom-1.5 left-1.5 bg-black/60 text-[10px] text-white">
                  {styleSpeed(s)}
                </Badge>
                {on && (
                  <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-4" />
                  </span>
                )}
              </div>
              <span className="px-2 py-1.5 text-xs leading-tight font-medium">{s.label.replace(/^(Animate|Bang Motion|Studio): /, '')}</span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
        {styleImage(current.id) && <img src={styleImage(current.id)} alt="" className="h-28 w-[84px] shrink-0 rounded-md object-cover" />}
        <div className="min-w-0 text-sm">
          <div className="font-medium">{current.label}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{current.description}</p>
        </div>
      </div>
    </div>
  );
}
