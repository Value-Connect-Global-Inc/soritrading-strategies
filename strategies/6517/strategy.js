/*
 * @coinsori-strategy v1
 * name: BTC Trend VolTarget 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends for weeks on the 4h chart. This is the same
 * proven trend recipe used by the multi-coin basket, but on a single symbol so it
 * can be compared directly against simply buying and holding BTC. It only holds
 * while the 4h trend is genuinely up and steps aside when the trend rolls over,
 * which gives a similar return to holding with a much smaller drawdown.
 * When it buys and sells: Buy when price is above a RISING 200-bar average
 * (uptrend confirmed); exit when price falls below a FALLING 200-bar average
 * (trend rolled over) or on a 30% hard stop. Position size shrinks automatically
 * in high-volatility weeks so the risk per bar stays roughly constant.
 * When it does NOT work: In a broad bear market the trend is down and it sits in
 * cash (safe but no upside, loses to holding in a rising window); in a choppy
 * sideways range near the 200-bar line it whipsaws and pays fees.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);      // trend line (closed bar)
  const smaOld = ctx.sma(200, 30);  // trend line 30 bars ago, for slope
  const atr = ctx.atr(14, 1);       // 4h volatility (closed bar)
  if (sma == null || smaOld == null || atr == null) { ctx.watch([]); return null; }

  const price = ctx.price;
  if (price == null || price <= 0) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;
  const uptrend = price > sma && sma > smaOld;      // entry: confirmed uptrend
  const rolledOver = price < sma && sma < smaOld;   // exit: trend truly rolled over

  // Constant-risk sizing: risk a fixed fraction of equity per 4h bar.
  const RISK_BUDGET = 0.012; // 1.2% of equity at risk per bar
  const atrPct = atr / price;
  let frac = atrPct > 0 ? RISK_BUDGET / atrPct : 0.5;
  if (frac > 0.98) frac = 0.98;   // cap: never more than ~all-in
  if (frac < 0.05) frac = 0.05;   // floor: never vanish in extreme vol

  // restart-surviving close of a position whose entry price is unknown
  if (pos !== 0 && ctx.entryPx == null) {
    const side = pos > 0 ? 'sell' : 'buy';
    const flag = 'restartClose_' + side;
    ctx.watch([{ side: side, price: price, trigger: pos > 0 ? 'below' : 'above', note: 'restart close' }]);
    if (ctx.state[flag]) return null;
    ctx.state[flag] = true;
    return { side: side, qty: Math.abs(pos), reduceOnly: true };
  }

  // while holding: exits only
  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : price;
    const stopPx = entry * 0.70; // hard stop at -30%
    ctx.watch([
      { side: 'sell', price: sma, trigger: 'below', note: 'trend rollover exit' },
      { side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop -30%' }
    ]);
    if (rolledOver || price <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // no new entries while the allocator is not ready
  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  // flat: enter on a confirmed uptrend
  if (uptrend) {
    const qty = (ctx.cash * frac) / price;
    if (qty <= 0) { ctx.watch([]); return null; }
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'uptrend entry' }]);
    return { side: 'buy', qty };
  }
  ctx.watch([]);
  return null;
}
