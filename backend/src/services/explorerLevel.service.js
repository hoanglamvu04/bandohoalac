import { calculateReputation, REPUTATION_LEVELS } from './reputation.service.js';

// Backward-compatible exports. Member levels are now Reputation v2 levels,
// not reward-point thresholds.
export const EXPLORER_LEVELS = REPUTATION_LEVELS;

export function getExplorerLevel(metrics = {}) {
  if (typeof metrics === 'number') {
    return calculateReputation({ qualityPoints: metrics });
  }
  return calculateReputation(metrics || {});
}
