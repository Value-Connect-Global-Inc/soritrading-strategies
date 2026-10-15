/*
 * @coinsori-strategy v1
 * name: Donchian Trend Breakout + SMA200 Filter (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Trend-following on ETH daily. A new 55-day close high
 * marks the start of an up-leg, but only counts as a buy when price is already
 * above its 200-day average — the long-term filter keeps the breakout out of
 * bear-market whipsaws where the plain 55/20 version churns. Exits on a 20-day
 * close low or a 30% hard stop.
 * When it buys and sells: buys when the close makes a new 55-day high AND the
 * close is above the 200-day average. Sells when the close makes a new 20-day
 * low, or a 30% hard stop is hit.
 * When it does NOT work: in a long sideways market hugging the 200-day average
 * the filter still lets whipsaws through; in a fast crash the 20-day low exit
 * lags and the stop takes a big hit before the exit fires.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null; // need 55 + 20 bars history for the channel

  // CLOSED bars only: prevClose is the last closed bar, and the channel is
  // built from bars STRICTLY BEFORE it, so a new high can actually trigger.
  const prevClose = closes[n - 2];

  // Long-term trend filter: close must be above the 200-day average (closed bar).
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const trendUp = prevClose > sma200;

  // Highest close of the 55 closed bars before prevClose (excludes prevClose).
  let hi55 = -Infinity;
  for (let i = n - 2 - 55; i <= n - 3; i++) {
    if (closes[i] > hi55) hi55 = closes[i];
  }
  // Lowest close of the 20 closed bars before prevClose (excludes prevClose).
  let lo20 = Infinity;
  for (let i = n - 2 - 20; i <= n - 3; i++) {
    if (closes[i] < lo20) lo20 = closes[i];
  }

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.70; // hard stop 30% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < lo20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '30% stop' },
               { side: 'sell', price: lo20, trigger: 'below', note: 'exit: 20d low',
                 conds: [{ label: 'close vs 20d low', ok: prevClose >= lo20, closed: true }] }]);
    return null;
  }

  const breakout = prevClose > hi55 && trendUp;
  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: 'enter: 55d high',
               conds: [{ label: 'close vs 55d high', ok: prevClose > hi55, closed: true },
                       { label: 'close > SMA200', ok: trendUp, closed: true }] }]);
  if (!breakout) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
