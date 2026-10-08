import { useEffect, useState } from 'react';

// ハッシュ方式の最小ルーター（GitHub Pages でリロードしても 404 にならない）
export function useRoute(): string[] {
  const parse = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || '').split('/').filter(Boolean).map(decodeURIComponent);
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const href = (...parts: string[]) => '#/' + parts.map(encodeURIComponent).join('/');
export const go = (...parts: string[]) => {
  location.hash = href(...parts);
};
