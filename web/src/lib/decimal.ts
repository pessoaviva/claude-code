/**
 * Fixed-point decimal arithmetic for auditable financial calculations.
 * Same engine as the backend — runs identically in the browser (BigInt).
 * Floats cannot represent 0.1 exactly; we store values as a scaled BigInt.
 */
export const SCALE = 8;
const SCALE_FACTOR = 10n ** BigInt(SCALE);

export class Decimal {
  readonly unscaled: bigint;

  private constructor(unscaled: bigint) {
    this.unscaled = unscaled;
  }

  static zero(): Decimal {
    return new Decimal(0n);
  }

  static from(value: string | number | Decimal): Decimal {
    if (value instanceof Decimal) return value;

    let str: string;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error(`Decimal.from: non-finite number "${value}"`);
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
    const unscaled = BigInt(intPart || "0") * SCALE_FACTOR + BigInt(fracPart || "0");
    return new Decimal(negative ? -unscaled : unscaled);
  }

  add(other: Decimal | string | number): Decimal {
    return new Decimal(this.unscaled + Decimal.from(other).unscaled);
  }
  sub(other: Decimal | string | number): Decimal {
    return new Decimal(this.unscaled - Decimal.from(other).unscaled);
  }
  mul(other: Decimal | string | number): Decimal {
    return new Decimal(divRoundHalfUp(this.unscaled * Decimal.from(other).unscaled, SCALE_FACTOR));
  }
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

  toFixed(places = 2): string {
    if (places < 0 || places > SCALE) throw new Error(`Decimal.toFixed: places must be 0..${SCALE}`);
    const dropFactor = 10n ** BigInt(SCALE - places);
    const rounded = divRoundHalfUp(this.unscaled, dropFactor);
    const negative = rounded < 0n;
    const digits = (negative ? -rounded : rounded).toString().padStart(places + 1, "0");
    const intPart = digits.slice(0, digits.length - places) || "0";
    const fracPart = places > 0 ? "." + digits.slice(digits.length - places) : "";
    return (negative ? "-" : "") + intPart + fracPart;
  }
  toNumber(): number {
    return Number(this.toFixed(SCALE));
  }
}

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
