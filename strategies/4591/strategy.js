/*
 * @coinsori-strategy v1
 * name: Funding-Squeeze Contrarian (futures)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * marketType: futures
 * cash: 10000
 *
 * Why this strategy: on perpetual futures, a deeply NEGATIVE funding rate means
 * shorts are paying longs — a crowded-short squeeze is building, a contrarian
 * long signal that the spot-only sentiment basket cannot see. This is a different
 * family: it buys pain, the champion buys greed.
 * When it buys and sells: buy when the funding rate is deeply negative (shorts
 * crowded), sell when funding normalizes, or on a -15% hard stop.
 * When it does NOT work: extreme negative funding is rare, so it may sit in
 * cash for long stretches; in a persistent bear, negative funding can stay
 * negative while price keeps falling, and the -15% stop turns a normal
 * squeeze into a loss. It misses every calm uptrend.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // ctx.funding is the current funding rate (fraction, e.g. -0.0005 = -0.05%).
  // If the venue does not expose it, guard and do nothing.
  const f = ctx.funding;
  if (!Number.isFinite(f)) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // -15% hard stop: a crowded-short trade gone wrong must not bleed.
      if (price <= entry * 0.85) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.85, trigger: 'below', note: 'stop: -15%' }]);
    }
    // Exit when funding normalizes — the squeeze is over, take the profit.
    if (f >= -0.0001) return { side: 'sell', qty: pos };
    return null;
  }

  // Deep negative funding = shorts paying heavily = crowded shorts about to
  // be squeezed. Threshold -0.05% per 8h funding. No trend gate: this IS a
  // bottom-fishing bet, so we take it when it appears.
  if (f <= -0.0005) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  // Declare what we are waiting for so the run card shows it.
  ctx.watch([{
    side: 'buy',
    price: price,
    trigger: 'below',
    note: 'enter: funding extreme negative',
    conds: [{ label: 'funding', now: f, op: '<=', ref: -0.0005, closed: true }]
  }]);
  return null;
}
