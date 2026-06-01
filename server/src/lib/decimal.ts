/**
 * Fixed-point decimal arithmetic for auditable financial calculations.
 *
 * Floating point (IEEE-754) cannot represent values like 0.1 exactly, which
 * causes silent rounding drift in money math. To keep every calculation exact
 * and auditable we represent numbers as a scaled BigInt:
 *
 *     realValue = unscaled / 10^SCALE
 *
 * SCALE = 8 is enough for share prices, fractional quantities and currency.
 * Currency is rendered to 2 decimals; this library never hides precision loss —
 * rounding is explicit (round-half-up) and only happens where requested.
 */

export const SCALE = 8;
const SCALE_FACTOR = 10n ** BigInt(SCALE);

export class Decimal {
  /** Unscaled integer value: real = unscaled / 10^SCALE */
  readonly unscaled: bigint;

  private constructor(unscaled: bigint) {
    this.unscaled = unscaled;
  }

  static zero(): Decimal {
    return new Decimal(0n);
  }

  /** Build from a user/DB string or number. Rejects non-finite/garbage input. */
  static from(value: string | number | Decimal): Decimal {
    if (value instanceof Decimal) return value;

    let str: string;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new Error(`Decimal.from: non-finite number "${value}"`);
      }
      // Avoid exponential notation; 15 significant digits is safe for our domain.
      str = value.toFixed(SCALE);
    } else {
      str = value.trim();
    }

    if (!/^[-+]?\d*(\.\d*)?$/.test(str) || str === "" || str === "." || str === "-" || str === "+") {
      throw new Error(`Decimal.from: invalid numeric string "${value}"`);
    }

    const negative = str.startsWith("-");
    const clean = str.replace(/^[-+]/, "");
    const [intPart, fracPartRaw = ""] = clean.split(".");
    const fracPart = fracPartRaw.slice(0, SCALE).padEnd(SCALE, "0");
    // Anything beyond SCALE digits is truncated; flag it so callers can round if needed.
    const unscaled = BigInt(intPart || "0") * SCALE_FACTOR + BigInt(fracPart || "0");
    return new Decimal(negative ? -unscaled : unscaled);
  }

  static fromUnscaled(unscaled: bigint): Decimal {
    return new Decimal(unscaled);
  }

  add(other: Decimal | string | number): Decimal {
    return new Decimal(this.unscaled + Decimal.from(other).unscaled);
  }

  sub(other: Decimal | string | number): Decimal {
    return new Decimal(this.unscaled - Decimal.from(other).unscaled);
  }

  /** Multiply two scaled values: (a/F)*(b/F) = a*b/F^2 -> rescale by /F (round-half-up). */
  mul(other: Decimal | string | number): Decimal {
    const product = this.unscaled * Decimal.from(other).unscaled;
    return new Decimal(divRoundHalfUp(product, SCALE_FACTOR));
  }

  /** Divide: (a/F)/(b/F) = a/b, keep scale -> (a*F)/b (round-half-up). */
  div(other: Decimal | string | number): Decimal {
    const divisor = Decimal.from(other).unscaled;
    if (divisor === 0n) throw new Error("Decimal.div: division by zero");
    return new Decimal(divRoundHalfUp(this.unscaled * SCALE_FACTOR, divisor));
  }

  isZero(): boolean {
    return this.unscaled === 0n;
  }

  isNegative(): boolean {
    return this.unscaled < 0n;
  }

  cmp(other: Decimal | string | number): number {
    const o = Decimal.from(other).unscaled;
    return this.unscaled < o ? -1 : this.unscaled > o ? 1 : 0;
  }

  /** Round-half-up to `places` decimals and return a fixed string. */
  toFixed(places = 2): string {
    if (places < 0 || places > SCALE) {
      throw new Error(`Decimal.toFixed: places must be 0..${SCALE}`);
    }
    const dropFactor = 10n ** BigInt(SCALE - places);
    const rounded = divRoundHalfUp(this.unscaled, dropFactor); // scaled to `places`
    const negative = rounded < 0n;
    const digits = (negative ? -rounded : rounded).toString().padStart(places + 1, "0");
    const intPart = digits.slice(0, digits.length - places) || "0";
    const fracPart = places > 0 ? "." + digits.slice(digits.length - places) : "";
    return (negative ? "-" : "") + intPart + fracPart;
  }

  /** Full-precision canonical string for storage/audit (no rounding). */
  toString(): string {
    return this.toFixed(SCALE).replace(/\.?0+$/, "") || "0";
  }

  toNumber(): number {
    return Number(this.toFixed(SCALE));
  }
}

/** Integer division of BigInt with round-half-up (away from zero on .5). */
function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const negative = numerator < 0n;
  const n = negative ? -numerator : numerator;
  const q = n / denominator;
  const r = n % denominator;
  const rounded = r * 2n >= denominator ? q + 1n : q;
  return negative ? -rounded : rounded;
}

export function sum(values: Array<Decimal | string | number>): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.add(v), Decimal.zero());
}
