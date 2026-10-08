import { useEffect } from 'react';
import { useNotes } from '../lib/notes';

/** 非公開バケットの自分の写真（署名付き URL で表示） */
export function Photo({ path, className, onClick }: { path: string; className?: string; onClick?: () => void }) {
  const { photoUrl, loadPhotoUrls } = useNotes();
  const url = photoUrl(path);
  useEffect(() => {
    if (!url) loadPhotoUrls([path]);
  }, [path, url, loadPhotoUrls]);
  return url ? <img className={className} src={url} alt="自分の写真" loading="lazy" onClick={onClick} /> : <div className={`img-fallback ${className ?? ''}`}>…</div>;
}
