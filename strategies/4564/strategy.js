/*
 * @coinsori-strategy v1
 * name: Hashrate Regime BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin network hash rate is a slow, smooth fundamental —
 * miners commit real hardware and electricity, so a rising hash rate signals a
 * healthy, growing network that historically precedes price strength, while a
 * falling hash rate marks miner stress and weak hands. Unlike user addresses it
 * does not whipsaw bar-to-bar. We use it as a regime filter with a long-term
 * trend gate so we never buy into a confirmed downtrend.
 * When it buys and sells: buys BTC (full size) when hash rate is above its
 * 30-day average AND price is above the 200-day SMA; sells when hash rate falls
 * below its 30-day average, or price drops 20% from entry (hard stop).
 * When it does NOT work: hash rate is a lagging, slow-mo signal — it keeps
 * rising for a while after price tops (miners keep hashing), so the regime can
 * stay long into the early part of a bear. In the chop after a hype cycle the
 * 200-day gate keeps it mostly in cash, missing sharp V-recoveries.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Hash rate regime from the connected on-chain dataset (TH/s, slow level —
  // compare to its own average, not a fixed threshold).
  const hr = ctx.data('hashrate');
  const sma = ctx.data('hashrate_sma30');
  if (hr == null || sma == null || sma <= 0) return null;
  const healthy = hr > sma; // network computing power above its 30-day average

  // Long-term trend gate: never buy into a confirmed downtrend.
  const trend = ctx.sma(200, 1);
  if (trend == null) return null;
  const uptrend = price > trend;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 20% hard stop: caps any single position's loss before the slow hash
      // rate regime can confirm the flip.
      const stopPx = entry * 0.80;
      if (price <= stopPx) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop: -20%' }]);
    }
    if (!healthy) return { side: 'sell', qty: pos }; // miner stress -> exit
    return null;
  }

  if (healthy && uptrend) {
    ctx.watch([{ side: 'buy', note: 'hashrate > 30d avg & trend up' }]);
    return { side: 'buy', qty: (ctx.cash * 0.95) / price };
  }
  ctx.watch([{ side: 'buy', note: 'wait: hashrate > 30d avg & trend up' }]);
  return null;
}
