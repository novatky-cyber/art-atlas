import { useState } from 'react';
import type { Artwork } from '../lib/types';
import { displayTitle } from '../lib/data';

export function ArtImage({ a, large = false, className }: { a: Artwork; large?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`img-fallback ${className ?? ''}`}>画像を読み込めません</div>;
  return (
    <img
      className={className}
      src={large ? a.image.large : a.image.thumb}
      alt={displayTitle(a)}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
