/*
 * @coinsori-strategy v1
 * name: Donchian Channel Breakout (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Real Bitcoin trends start with a decisive break of an old
 * high. Instead of relying on an average (EMA) or a fixed return window, we buy
 * when price closes above the highest close of the last 55 days — a level that
 * only happens when the market is genuinely making new ground. We ride the move
 * until price closes below the lowest close of the last 20 days.
 * When it buys and sells: buys when the previous close exceeds the highest close
 * of the prior 55 days. Sells when the previous close falls below the lowest
 * close of the prior 20 days, or price drops 3x the 14-day ATR below the recent
 * close (trailing protection).
 * When it does NOT work: in a long sideways range the channel keeps getting
 * broken in both directions and the strategy whipsaws, paying fees on every
 * false breakout. It also enters late — it needs a full new high, so it misses
 * the first leg of a fresh rally that the momentum strategies catch.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 60) return null;
  const prevClose = c.at(-2);

  // 55-day upper channel = highest CLOSE of the 55 bars BEFORE the last closed bar
  // (so the breakout compares prevClose against levels that were already known).
  let hi55 = -Infinity;
  for (let k = c.length - 2 - 55; k < c.length - 2; k++) {
    if (c[k] > hi55) hi55 = c[k];
  }
  // 20-day lower channel = lowest CLOSE of the 20 bars BEFORE the last closed bar.
  let lo20 = Infinity;
  for (let k = c.length - 2 - 20; k < c.length - 2; k++) {
    if (c[k] < lo20) lo20 = c[k];
  }

  const atr = ctx.atr(14, 1);
  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    if (prevClose < lo20) return { side: 'sell', qty: pos };   // trend broke down
    // trailing protection: 3x ATR below the last closed close
    if (atr != null && atr > 0 && price <= prevClose - 3 * atr) {
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: lo20, trigger: 'below', note: '20-day low breakdown' },
               { side: 'sell', price: prevClose - 3 * atr, trigger: 'below', note: '3x ATR trail' }]);
    return null;
  }

  const breakout = prevClose > hi55;   // new 55-day closing high on a closed bar
  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: '55-day high breakout',
               conds: [{ label: 'close > 55d high', ok: breakout, closed: true }] }]);
  if (!breakout) return null;

  const qty = (ctx.cash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
