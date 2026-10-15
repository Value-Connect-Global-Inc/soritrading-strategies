/*
 * @coinsori-strategy v1
 * name: Oversold Dip Mean-Revert (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: inside a longer uptrend, sharp oversold sell-offs tend to be
 * bought back quickly (dips revert to the rising mean). We buy only oversold dips
 * while the 200-day trend is up, so we are never short and never buy into a real
 * bear market.
 * When it buys and sells: buys when RSI(14) is at/below 30 while the close is above
 * the 200-day EMA. Sells when RSI recovers to 55+, the close falls below the 200-day
 * EMA, or a 20% hard stop is hit.
 * When it does NOT work: in a real bear market the close is below the 200-day EMA so
 * we stay out and miss the bottom; and a deep crash can keep RSI oversold for weeks
 * while price keeps falling (the stop caps the damage).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);

  const rsi = ctx.rsi(14, 1);
  if (rsi == null) return null;

  // volatility target: size so the position contributes ~2% daily vol to the pool
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.80;          // hard stop: 20% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (rsi >= 55) return { side: 'sell', qty: pos };            // dip reverted to mean
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '20% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: 'RSI < 55', ok: rsi < 55, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  const oversold = rsi <= 30;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-EMA',
               conds: [{ label: 'RSI <= 30 (oversold)', ok: oversold, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !oversold) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
