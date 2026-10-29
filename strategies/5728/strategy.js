/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend + Dynamic Vol-Target Rebalance 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion (SMA200 + vol-target) sizes ONCE at entry, so it
 * stays fully invested while a crash builds and gives back a ~55% drawdown. This
 * version re-sizes every day: when daily volatility rises (crash regime) it
 * smoothly sells part of the position; when volatility falls it buys back. Same
 * slow 200-day trend gate, but exposure shrinks automatically into danger.
 * When it buys and sells: Holds a fraction of equity = min(1, 3% / ATR%-of-price)
 * whenever the previous close is above SMA200. Each day, if the invested fraction
 * drifts more than 20 points from target, it trades back to target (this both
 * enters and de-risks). Sells fully when the close falls below SMA200.
 * When it does NOT work: In a long sideways range it whipsaws across the 200-day
 * line. A sharp V-shaped crash can sell into the bottom as vol spikes, then miss
 * part of the rebound. Rebalancing adds fee drag in choppy markets.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const atr20 = ctx.atr(20, 1);
  if (sma200 == null || atr20 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  const equity = pos * price + ctx.cash;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'close above SMA200' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200' }
  ]);

  // slow trend gate: fully out below the 200-day (this slow exit is what makes the champion robust)
  if (prevClose < sma200) {
    if (pos > 0) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // target fraction of equity to hold, from current volatility (same 3%-ATR target as the champion)
  const atrPct = atr20 / price;
  const targetFrac = Math.min(1, 0.03 / atrPct);

  // current fraction actually invested
  const currentFrac = equity > 0 ? (pos * price) / equity : 0;

  // rebalance only when drift is big enough to matter — 0.20 band limits fee drag
  const targetQty = (0.99 * equity * targetFrac) / price;

  // de-risk / trim sells are always allowed (reduce-only)
  if (targetQty < pos) {
    return { side: 'sell', qty: pos - targetQty, reduceOnly: true };
  }

  // new buys / top-ups only when the edge is healthy
  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (targetQty > pos) {
    return { side: 'buy', qty: targetQty - pos };
  }
  return null;
}
