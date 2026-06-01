import { config } from "../config.js";
import { Decimal } from "./decimal.js";

/**
 * Reliability classification A/B/C for a quote, based on its age and validity.
 *
 *  A (Confiável)      : fonte real, cotação válida, idade < freshMinutes (15)
 *                       -> permite Lucro/Prejuízo, Rentabilidade e Patrimônio
 *  B (Desatualizada)  : idade entre freshMinutes e staleMinutes (15..60)
 *                       -> permite Patrimônio; bloqueia L/P e Rentabilidade
 *  C (Não confiável)  : API falhou, cotação inválida, sem cotação, ou idade > 60
 *                       -> bloqueia L/P e Rentabilidade; entra só no estimado
 */
export type ReliabilityLevel = "A" | "B" | "C";

export interface Reliability {
  level: ReliabilityLevel;
  label: string;
  reason: string;
  ageMinutes: number | null;
  allowProfit: boolean; // L/P e rentabilidade
  countsOfficialNetWorth: boolean; // entra no patrimônio oficial (A e B)
  countsEstimatedNetWorth: boolean; // entra no patrimônio estimado (A, B e C com última cotação)
}

const LABELS: Record<ReliabilityLevel, string> = {
  A: "Confiável",
  B: "Cotação desatualizada",
  C: "Cotação não confiável",
};

export function classify(
  fetchedAt: string | Date | null | undefined,
  hasValidPrice: boolean
): Reliability {
  const fresh = config.reliability.freshMinutes;
  const stale = config.reliability.staleMinutes;

  if (!fetchedAt || !hasValidPrice) {
    return {
      level: "C",
      label: LABELS.C,
      reason: !hasValidPrice ? "Cotação inválida ou ausente" : "Sem cotação",
      ageMinutes: null,
      allowProfit: false,
      countsOfficialNetWorth: false,
      countsEstimatedNetWorth: hasValidPrice, // só conta se há um preço conhecido
    };
  }

  const ts = typeof fetchedAt === "string" ? new Date(fetchedAt) : fetchedAt;
  const ageMinutes = Math.max(0, (Date.now() - ts.getTime()) / 60000);
  const ageRounded = Math.round(ageMinutes);

  if (ageMinutes < fresh) {
    return {
      level: "A",
      label: LABELS.A,
      reason: `Atualizada há ${ageRounded} min (fonte real)`,
      ageMinutes,
      allowProfit: true,
      countsOfficialNetWorth: true,
      countsEstimatedNetWorth: true,
    };
  }
  if (ageMinutes <= stale) {
    return {
      level: "B",
      label: LABELS.B,
      reason: `Atualizada há ${ageRounded} min`,
      ageMinutes,
      allowProfit: false,
      countsOfficialNetWorth: true,
      countsEstimatedNetWorth: true,
    };
  }
  return {
    level: "C",
    label: LABELS.C,
    reason: `Atualizada há ${ageRounded} min (acima de ${stale} min)`,
    ageMinutes,
    allowProfit: false,
    countsOfficialNetWorth: false,
    countsEstimatedNetWorth: true, // usa a última cotação conhecida
  };
}

/**
 * Nota de confiabilidade (0–100) por ativo. Deterministic and auditable: the
 * breakdown is returned so the score can always be explained.
 *
 *   success     (40): taxa de sucesso das integrações (sucessos/total)
 *   freshness   (25): A=100, B=60, C=20, sem cotação=0
 *   frequency   (15): nº de cotações recentes (até 5 -> 100)
 *   consistency (20): 100 menos o maior salto relativo recente de preço
 */
export interface ScoreInput {
  successes: number;
  failures: number;
  level: ReliabilityLevel | null;
  recentQuoteCount: number;
  recentPrices: string[]; // mais recente primeiro
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
  // Sem histórico de integração (ex.: só manual) -> baseline neutro de 0.7.
  const successRate = total === 0 ? 0.7 : input.successes / total;
  const success = successRate * 40;

  const freshness =
    input.level === "A" ? 25 : input.level === "B" ? 15 : input.level === "C" ? 5 : 0;

  const frequency = Math.min(15, input.recentQuoteCount * 3);

  let consistency = 14; // neutro quando há poucos dados (de um máx. de 20)
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
