/*
 * @coinsori-strategy v1
 * name: FearGreed Contrarian BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A third signal family — market SENTIMENT instead of price
 * or on-chain. Uses the Crypto Fear & Greed index (0-100). Classic contrarian
 * hypothesis: extreme fear marks capitulation bottoms (buy), extreme greed
 * marks euphoric tops (sell). Hysteresis keeps it from churning in the middle.
 * When it buys and sells: buys when sentiment is deeply fearful (<=25), sells
 * when it turns greedy (>=70). Stays flat in the neutral middle.
 * When it does NOT work: in a persistent bull market it sits out most of the
 * rally (fear rarely triggers) and can sell too early into continued gains;
 * in a grinding bear it buys falling knives at every fear spike. Slow, few
 * trades, long flat periods.
 *
 * 2025-01-11: display-only ctx.watch added — no change to trade logic.
 */
function onUpdate(ctx) {
  const pos = ctx.position;

  const raw = ctx.data('fear_greed');
  const v = Number(raw);
  if (!Number.isFinite(v)) {
    ctx.watch([]);
    return null; // sentiment unavailable: sit out
  }

  if (pos > 0) {
    // Sell when greed takes over (>=70) — crowd euphoria is the exit signal.
    if (v >= 70) {
      ctx.watch([{ side: 'sell', price: v, trigger: 'above', note: 'greed exit', conds: [{ label: 'F&G index', now: v, op: '>=', ref: 70 }] }]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: 70, trigger: 'above', note: 'greed exit', conds: [{ label: 'F&G index', now: v, op: '>=', ref: 70 }] }]);
    return null;
  }
  // Buy only at deep fear (<=25) — capitulation is the entry signal.
  if (v <= 25) {
    ctx.watch([{ side: 'buy', price: v, trigger: 'below', note: 'fear entry', conds: [{ label: 'F&G index', now: v, op: '<=', ref: 25 }] }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  ctx.watch([{ side: 'buy', price: 25, trigger: 'below', note: 'fear entry', conds: [{ label: 'F&G index', now: v, op: '<=', ref: 25 }] }]);
  return null;
}
