/*
 * @coinsori-strategy v1
 * name: MultiTimeframe Trend 1D/4H Basket
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the 4h EMA50/200 core (+285/+112/+57) catches trends but
 * whipsaws in chop; the 1d EMA50/200 version (positive on all 3 windows) is
 * calmer but misses moves. A multi-timeframe stack uses the slow daily trend
 * as a regime gate and the fast 4h trend for timing, so entries only happen
 * when BOTH agree the trend is up — cutting the 4h core's chop entries without
 * losing the 1d core's conviction. This is a genuinely different family from
 * either single-timeframe version.
 * When it buys and sells: on each asset, buy on a fresh 4h bullish EMA50/200
 * cross ONLY while the 1d trend is up (50d EMA > 200d EMA). Sell on the 4h
 * death cross or when price falls 2.5 ATR below entry. A 24-bar 4h cooldown after
 * an exit prevents instant re-entry whipsaw.
 * When it does NOT work: in a sideways market where the daily trend is barely up
 * but 4h crosses chop, it still churns; and the 1d gate can turn a 4h trend
 * signal off late in a top, so it lags a melt-up top and a V-shaped crash.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // 4h closed-bar EMAs for timing (identical in backtest, paper, live).
  const f4 = ctx.ema(50, 1), s4 = ctx.ema(200, 1);
  const fp4 = ctx.ema(50, 2), sp4 = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  if (f4 == null || s4 == null || fp4 == null || sp4 == null || atr == null) return null;

  const sym = ctx.sym;
  const st = ctx.state || {};
  if (!st.cool) st.cool = {};

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry - 2.5 * atr : price - 2.5 * atr;
    if (f4 <= s4) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    if (price <= stopPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop 2.5 ATR from entry' }]);
    return null;
  }

  const lastExit = st.cool[sym];
  if (lastExit != null && ctx.i - lastExit < 24) return null;

  // 1d regime gate: the daily trend must be up for a 4h entry to be valid.
  // Uses closed daily bars (ago>=1) so it is identical in backtest and live.
  const f1 = ctx.ema(50, 1), s1 = ctx.ema(200, 1);
  if (f1 == null || s1 == null) return null;
  const dailyUp = f1 > s1;
  if (!dailyUp) return null;

  // 4h fresh bullish cross only (no re-entry branch — the gate is the point).
  if (fp4 <= sp4 && f4 > s4) {
    const riskCash = ctx.cash * 0.01;
    const stopDist = 2.5 * atr;
    let qty = stopDist > 0 ? riskCash / stopDist : 0;
    const maxQty = (ctx.cash * 0.99) / price;
    if (qty > maxQty) qty = maxQty;
    if (qty <= 0) return null;
    return { side: 'buy', qty };
  }

  ctx.watch([{ side: 'buy', note: '4h cross with 1d regime up', conds: [
    { label: '1d EMA50>EMA200', ok: dailyUp },
    { label: '4h cross ready', ok: fp4 <= sp4 && f4 > s4 }
  ]}]);
  return null;
}
