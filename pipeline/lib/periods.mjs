// 年（中央値）と地域の時代区分スキームから、地域別時代 period と世界共通 era を割り当てる
const pick = (list, year) => {
  if (year == null || !list.length) return null;
  const hit = list.find((p) => year >= p.start && year <= p.end);
  if (hit) return hit;
  return list.reduce((best, p) => {
    const d = Math.min(Math.abs(year - p.start), Math.abs(year - p.end));
    return !best || d < best.d ? { ...p, d } : best;
  }, null);
};

export function assignPeriod(periods, scheme, year, override) {
  const byScheme = periods.filter((p) => p.scheme === scheme);
  const world = periods.filter((p) => p.scheme === 'world');
  let estimatedYear = null;
  let period = null;
  if (override) {
    period = periods.find((p) => p.id === override) ?? null;
    if (year == null && period) estimatedYear = Math.round((Math.max(period.start, -5000) + period.end) / 2);
  } else {
    period = pick(byScheme, year);
  }
  const y = year ?? estimatedYear;
  return { period: period?.id ?? null, era: pick(world, y)?.id ?? null, estimatedYear };
}
