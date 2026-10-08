import { useEffect, useRef, useState } from 'react';

/** 全画面ビューア：ピンチで拡大、ドラッグで移動、ダブルタップで 1x/2.5x 切替 */
export function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ s: number; x: number; y: number; dist: number; cx: number; cy: number } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const snapshot = () => {
    const pts = [...pointers.current.values()];
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    start.current = { ...t, dist, cx, cy };
  };

  return (
    <div
      className="viewer"
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        snapshot();
        if (pointers.current.size === 1) {
          const now = Date.now();
          if (now - lastTap.current < 300) setT((v) => (v.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 }));
          lastTap.current = now;
        }
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId) || !start.current) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const pts = [...pointers.current.values()];
        const st = start.current;
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        let s = st.s;
        if (pts.length > 1 && st.dist > 0) {
          s = Math.min(8, Math.max(1, (st.s * Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)) / st.dist));
        }
        setT({ s, x: st.x + (cx - st.cx), y: st.y + (cy - st.cy) });
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size) snapshot();
        else setT((v) => (v.s <= 1.02 ? { s: 1, x: 0, y: 0 } : v));
      }}
      onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
    >
      <img src={src} alt={alt} draggable={false} style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }} />
      <button className="viewer-close" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="閉じる">
        ✕
      </button>
      <div className="viewer-hint">ピンチで拡大・ダブルタップで切替</div>
    </div>
  );
}
