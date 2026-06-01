import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, computeScore } from "../lib/reliability.js";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60000);

test("level A: fresh valid quote allows profit and net worth", () => {
  const r = classify(minutesAgo(5), true);
  assert.equal(r.level, "A");
  assert.equal(r.allowProfit, true);
  assert.equal(r.countsOfficialNetWorth, true);
});

test("level B: 15-60 min blocks profit but counts net worth", () => {
  const r = classify(minutesAgo(30), true);
  assert.equal(r.level, "B");
  assert.equal(r.allowProfit, false);
  assert.equal(r.countsOfficialNetWorth, true);
  assert.equal(r.label, "Cotação desatualizada");
});

test("boundary at 15 min is B (A is strictly < 15)", () => {
  assert.equal(classify(minutesAgo(15), true).level, "B");
  assert.equal(classify(minutesAgo(14.9), true).level, "A");
});

test("level C: over 60 min blocks profit and official net worth, keeps estimated", () => {
  const r = classify(minutesAgo(120), true);
  assert.equal(r.level, "C");
  assert.equal(r.allowProfit, false);
  assert.equal(r.countsOfficialNetWorth, false);
  assert.equal(r.countsEstimatedNetWorth, true);
  assert.equal(r.label, "Cotação não confiável");
});

test("no quote -> level C, nothing allowed", () => {
  const r = classify(null, false);
  assert.equal(r.level, "C");
  assert.equal(r.allowProfit, false);
  assert.equal(r.countsOfficialNetWorth, false);
  assert.equal(r.countsEstimatedNetWorth, false);
});

test("score is 0-100 and rewards success + freshness", () => {
  const good = computeScore({ successes: 20, failures: 0, level: "A", recentQuoteCount: 5, recentPrices: ["10", "10.1", "10.05"] });
  const bad = computeScore({ successes: 1, failures: 19, level: "C", recentQuoteCount: 1, recentPrices: [] });
  assert.ok(good.score > bad.score);
  assert.ok(good.score <= 100 && bad.score >= 0);
});

test("score penalizes inconsistent (volatile) prices", () => {
  const stable = computeScore({ successes: 10, failures: 0, level: "A", recentQuoteCount: 3, recentPrices: ["10", "10", "10"] });
  const volatile = computeScore({ successes: 10, failures: 0, level: "A", recentQuoteCount: 3, recentPrices: ["10", "5", "20"] });
  assert.ok(stable.consistency > volatile.consistency);
});

test("no integration history uses neutral baseline (not zero)", () => {
  const s = computeScore({ successes: 0, failures: 0, level: "A", recentQuoteCount: 1, recentPrices: ["10"] });
  assert.ok(s.successRate === 70);
});
