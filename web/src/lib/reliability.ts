import { Decimal } from "./decimal";

// A/B/C thresholds (minutes). A: < FRESH ; B: FRESH..STALE ; C: > STALE.
export const FRESH_MINUTES = 15;
export const STALE_MINUTES = 60;

export type ReliabilityLevel = "A" | "B" | "C";

export interface Reliability {
  level: ReliabilityLevel;
  label: string;
  reason: string;
  ageMinutes: number | null;
  allowProfit: boolean;
  countsOfficialNetWorth: boolean;
  countsEstimatedNetWorth: boolean;
}

const LABELS: Record<ReliabilityLevel, string> = {
  A: "Confiável",
  B: "Cotação desatualizada",
  C: "Cotação não confiável",
};

export function classify(fetchedAt: string | Date | null | undefined, hasValidPrice: boolean): Reliability {
  if (!fetchedAt || !hasValidPrice) {
    return {
      level: "C",
      label: LABELS.C,
      reason: !hasValidPrice ? "Cotação inválida ou ausente" : "Sem cotação",
      ageMinutes: null,
      allowProfit: false,
      countsOfficialNetWorth: false,
      countsEstimatedNetWorth: hasValidPrice,
    };
  }

  const ts = typeof fetchedAt === "string" ? new Date(fetchedAt) : fetchedAt;
  const ageMinutes = Math.max(0, (Date.now() - ts.getTime()) / 60000);
  const ageRounded = Math.round(ageMinutes);

  if (ageMinutes < FRESH_MINUTES) {
    return { level: "A", label: LABELS.A, reason: `Atualizada há ${ageRounded} min (fonte real)`, ageMinutes, allowProfit: true, countsOfficialNetWorth: true, countsEstimatedNetWorth: true };
  }
  if (ageMinutes <= STALE_MINUTES) {
    return { level: "B", label: LABELS.B, reason: `Atualizada há ${ageRounded} min`, ageMinutes, allowProfit: false, countsOfficialNetWorth: true, countsEstimatedNetWorth: true };
  }
  return { level: "C", label: LABELS.C, reason: `Atualizada há ${ageRounded} min (acima de ${STALE_MINUTES} min)`, ageMinutes, allowProfit: false, countsOfficialNetWorth: false, countsEstimatedNetWorth: true };
}

export interface ScoreInput {
  successes: number;
  failures: number;
  level: ReliabilityLevel | null;
  recentQuoteCount: number;
  recentPrices: string[];
}
export interface ScoreBreakdown {
  score: number;
  success: number;
  freshness: number;
  frequency: number;
  consistency: number;
  successRate: number;
}

export function computeScore(input: ScoreInput): ScoreBreakdown {
  const total = input.successes + input.failures;
  const successRate = total === 0 ? 0.7 : input.successes / total;
  const success = successRate * 40;

  const freshness = input.level === "A" ? 25 : input.level === "B" ? 15 : input.level === "C" ? 5 : 0;
  const frequency = Math.min(15, input.recentQuoteCount * 3);

  let consistency = 14;
  if (input.recentPrices.length >= 2) {
    let maxJumpPct = 0;
    for (let i = 1; i < input.recentPrices.length; i++) {
      const prev = Decimal.from(input.recentPrices[i]);
      const cur = Decimal.from(input.recentPrices[i - 1]);
      if (prev.isZero()) continue;
      const jump = Math.abs(cur.sub(prev).div(prev).mul(100).toNumber());
      if (jump > maxJumpPct) maxJumpPct = jump;
    }
    consistency = Math.max(0, 20 - Math.min(20, maxJumpPct));
  }

  const score = Math.round(success + freshness + frequency + consistency);
  return {
    score: Math.max(0, Math.min(100, score)),
    success: Math.round(success),
    freshness,
    frequency,
    consistency: Math.round(consistency),
    successRate: Number((successRate * 100).toFixed(1)),
  };
}
