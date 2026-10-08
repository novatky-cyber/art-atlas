import { useRef, useState } from 'react';
import type { Highlight } from '../lib/types';

/**
 * 画像の上に番号付き注釈ピンを重ねる。editing 中はピンをドラッグして位置を調整できる。
 * 位置は画像に対するパーセント。
 */
export function Annotated({
  src,
  alt,
  highlights,
  positions,
  editing,
  onMove,
  onOpen,
  active,
  onSelect,
}: {
  src: string;
  alt: string;
  highlights: Highlight[];
  positions: { x: number; y: number }[];
  editing: boolean;
  onMove: (i: number, p: { x: number; y: number }) => void;
  onOpen: () => void;
  active: number | null;
  onSelect: (i: number | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const pos = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return {
      x: Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))),
      y: Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))),
    };
  };
  if (failed) return <div className="img-fallback hero-fallback">画像を読み込めません</div>;
  return (
    <div className={`annot ${editing ? 'editing' : ''}`}>
      <div
        className="annot-box"
        ref={box}
        onPointerMove={(e) => drag !== null && onMove(drag, pos(e))}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <img src={src} alt={alt} onClick={() => !editing && onOpen()} onError={() => setFailed(true)} draggable={false} />
        {highlights.map((_, i) => {
          const p = positions[i] ?? { x: 50, y: 50 };
          return (
            <button
              key={i}
              type="button"
              className={`pin ${active === i ? 'active' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onPointerDown={(e) => {
                if (!editing) return;
                e.preventDefault();
                (e.target as Element).setPointerCapture?.(e.pointerId);
                setDrag(i);
              }}
              onClick={() => !editing && onSelect(active === i ? null : i)}
              aria-label={`見どころ${i + 1}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
