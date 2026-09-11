export interface ScoringOptions {
  basePoints: number;
  durationMs: number;
  responseTimeMs: number;
  isCorrect: boolean;
  mode?: 'Classic' | 'NoSpeed' | 'DoublePoints';
}

export class ScoringEngine {
  public static calculateScore(options: ScoringOptions): number {
    const { basePoints, durationMs, responseTimeMs, isCorrect, mode = 'Classic' } = options;

    if (!isCorrect) {
      return 0;
    }

    if (mode === 'NoSpeed') {
      return basePoints;
    }

    const multiplier = mode === 'DoublePoints' ? 2 : 1;

    // Server-authoritative time clamp
    const clampedResponseTime = Math.max(0, Math.min(responseTimeMs, durationMs));

    // Speed factor: 1.0 for instantaneous, down to 0.5 for answering at deadline
    const speedRatio = 1 - (clampedResponseTime / durationMs) / 2;

    return Math.round(basePoints * speedRatio * multiplier);
  }
}
