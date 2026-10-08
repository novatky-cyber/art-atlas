import { href } from '../lib/router';

const TABS = [
  { key: '', label: '手帳', icon: '✎' },
  { key: 'explore', label: '探索', icon: '◎' },
  { key: 'timeline', label: '年表', icon: '☰' },
  { key: 'connect', label: 'つなぐ', icon: '⟡' },
];

export function TabBar({ current }: { current: string }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <a key={t.key} href={href(...(t.key ? [t.key] : []))} className={current === t.key ? 'active' : ''}>
          <span className="tab-icon">{t.icon}</span>
          <span className="tab-label">{t.label}</span>
        </a>
      ))}
    </nav>
  );
}
