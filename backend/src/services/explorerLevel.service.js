export const EXPLORER_LEVELS = [
  { code: 'EXPLORER', name: 'Explorer', minPoints: 0, nextPoints: 100 },
  { code: 'LOCAL_EXPLORER', name: 'Local Explorer', minPoints: 100, nextPoints: 500 },
  { code: 'TRUSTED_EXPLORER', name: 'Trusted Explorer', minPoints: 500, nextPoints: 1500 },
  { code: 'HOA_LAC_EXPERT', name: 'Hòa Lạc Expert', minPoints: 1500, nextPoints: 5000 },
  { code: 'HOA_LAC_INSIDER', name: 'Hòa Lạc Insider', minPoints: 5000, nextPoints: null }
];

export function getExplorerLevel(points = 0) {
  const total = Math.max(Number(points) || 0, 0);
  const current = [...EXPLORER_LEVELS]
    .reverse()
    .find((level) => total >= level.minPoints) || EXPLORER_LEVELS[0];

  const next = EXPLORER_LEVELS.find((level) => level.minPoints > total) || null;
  const span = next ? Math.max(next.minPoints - current.minPoints, 1) : 1;
  const progress = next
    ? Math.min(Math.max((total - current.minPoints) / span, 0), 1)
    : 1;

  return {
    ...current,
    points: total,
    nextLevel: next ? { code: next.code, name: next.name, minPoints: next.minPoints } : null,
    pointsToNext: next ? Math.max(next.minPoints - total, 0) : 0,
    progress: Number(progress.toFixed(4))
  };
}
