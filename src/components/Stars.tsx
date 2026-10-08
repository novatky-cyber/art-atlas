export function Stars({ value, onChange, size = 28 }: { value: number | null; onChange?: (v: number | null) => void; size?: number }) {
  return (
    <span className="stars" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star ${value && n <= value ? 'on' : ''}`}
          disabled={!onChange}
          onClick={() => onChange?.(value === n ? null : n)}
          aria-label={`感動度${n}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}
