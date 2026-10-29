/*
 * @coinsori-strategy v1
 * name: BTC Donchian 55/20 Breakout 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ledger consistently validates this exact recipe on BTC 1d
 * (Donchian 55/20 breakout, 2% risk sizing, 2xATR trailing stop, 25% disaster stop)
 * as positive across walk-forward windows. A close above the 55-day high marks a
 * genuine trend start; a close below the 20-day low ends it. Risk-based sizing keeps
 * each failed breakout cheap so the big winners pay for the small losses.
 * When it buys and sells: It buys when the previous close breaks above the 55-day
 * high (as of the day before). Position size is set so the 2xATR stop costs only 2%
 * of equity. It sells on a 2xATR trailing stop below the highest close since entry,
 * a close below the 20-day low, or a 25% disaster stop.
 * When it does NOT work: In a long choppy range it buys failed breakouts repeatedly —
 * many small losses. It gives back part of the top before the trail catches the
 * reversal, and it lags a straight-line melt-up if the breakout entry is delayed.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const hi55 = ctx.high(55, 2); // 55-day high BEFORE the last close
  const lo20 = ctx.low(20, 1);
  const atr = ctx.atr(14, 1);
  if (hi55 == null || lo20 == null || atr == null || atr <= 0) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trail = peak - 2 * atr; // 2x ATR trail — the validated setting
    const disaster = ctx.entryPx != null ? ctx.entryPx * 0.75 : null; // 25% disaster stop
    ctx.watch([
      { side: 'sell', price: lo20, trigger: 'below', note: 'Donchian 20 low' },
      { side: 'sell', price: trail, trigger: 'below', note: '2 ATR trail' },
      { side: 'sell', price: disaster, trigger: 'below', note: '25% disaster stop' }
    ]);
    if (price < lo20) { ctx.state.peak = null; return { side: 'sell', qty: pos, reduceOnly: true }; }
    if (price < trail) { ctx.state.peak = null; return { side: 'sell', qty: pos, reduceOnly: true }; }
    if (disaster != null && price < disaster) { ctx.state.peak = null; return { side: 'sell', qty: pos, reduceOnly: true }; }
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  if (prevClose > hi55) {
    // Risk-based sizing: the 2xATR stop distance costs only 2% of equity.
    const stopDist = 2 * atr;
    if (stopDist <= 0) return null;
    let qty = (0.02 * ctx.cash) / stopDist;
    const maxQty = (0.95 * ctx.cash) / price;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.state.peak = price;
    return { side: 'buy', qty: qty };
  }
  return null;
}
