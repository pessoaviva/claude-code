import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal, sum } from "../lib/decimal.js";

test("addition is exact where floats fail (0.1 + 0.2)", () => {
  assert.equal(Decimal.from("0.1").add("0.2").toFixed(2), "0.30");
});

test("repeated addition does not drift", () => {
  let acc = Decimal.zero();
  for (let i = 0; i < 10; i++) acc = acc.add("0.1");
  assert.equal(acc.toFixed(2), "1.00");
});

test("multiplication of quantity by price", () => {
  // 12.5 shares * 31.27 = 390.875 -> 390.88 (round half up)
  assert.equal(Decimal.from("12.5").mul("31.27").toFixed(2), "390.88");
});

test("division and percentage (rentabilidade)", () => {
  // profit 250 / invested 1000 = 25%
  const profit = Decimal.from("250");
  const invested = Decimal.from("1000");
  assert.equal(profit.div(invested).mul(100).toFixed(2), "25.00");
});

test("round half up at the boundary", () => {
  assert.equal(Decimal.from("2.005").toFixed(2), "2.01");
  assert.equal(Decimal.from("-2.005").toFixed(2), "-2.01");
});

test("negative values (prejuízo)", () => {
  const current = Decimal.from("800");
  const invested = Decimal.from("1000");
  assert.equal(current.sub(invested).toFixed(2), "-200.00");
  assert.equal(current.sub(invested).isNegative(), true);
});

test("sum helper over a list", () => {
  assert.equal(sum(["10.10", "20.20", "30.30"]).toFixed(2), "60.60");
});

test("rejects invalid input instead of masking", () => {
  assert.throws(() => Decimal.from("abc"));
  assert.throws(() => Decimal.from("1.2.3"));
  assert.throws(() => Decimal.from(Infinity));
});

test("division by zero throws (never masked)", () => {
  assert.throws(() => Decimal.from("1").div("0"));
});

test("high precision preserved up to scale", () => {
  // 8 decimals of scale; share price like 0.00012345
  assert.equal(Decimal.from("0.00012345").toFixed(8), "0.00012345");
});

test("comparison", () => {
  assert.equal(Decimal.from("1.50").cmp("1.49"), 1);
  assert.equal(Decimal.from("1.49").cmp("1.50"), -1);
  assert.equal(Decimal.from("1.50").cmp("1.50"), 0);
});
