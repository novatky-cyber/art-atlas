import { useMemo } from 'react';
import { useDb } from '../lib/data';
import { href } from '../lib/router';

/** 本文中の用語（用語集の aliases）を自動で用語集ページへリンクする。同じ用語は最初の1回だけ。 */
export function LinkedText({ text, className }: { text: string; className?: string }) {
  const db = useDb();
  const { re, byAlias } = useMemo(() => {
    const pairs = db.glossary.flatMap((t) => t.aliases.map((a) => [a, t.id] as const)).sort((a, b) => b[0].length - a[0].length);
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { re: new RegExp(`(${pairs.map(([a]) => esc(a)).join('|')})`, 'g'), byAlias: Object.fromEntries(pairs) };
  }, [db]);
  const used = new Set<string>();
  const parts = text.split(re);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const id = byAlias[p];
        if (!id || used.has(id)) return p;
        used.add(id);
        return (
          <a key={i} className="term" href={href('glossary', id)}>
            {p}
          </a>
        );
      })}
    </span>
  );
}
