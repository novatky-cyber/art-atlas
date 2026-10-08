import { href } from '../lib/router';

const TABS = [
  { key: '', label: '探索', icon: '◎' },
  { key: 'quiz', label: '今日の10問', icon: '✎' },
  { key: 'collection', label: '図鑑', icon: '▦' },
  { key: 'compare', label: '同時代', icon: '⇆' },
  { key: 'settings', label: '設定', icon: '⚙' },
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
