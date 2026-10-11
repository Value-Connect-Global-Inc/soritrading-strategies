/*
 * @coinsori-strategy v1
 * name: BTC EMA Pullback 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: in a strong uptrend, price pulls back to the 20-day EMA
 * and bounces — buying the dip near the EMA in an uptrend has a positive
 * expectancy. We sell at the upper Bollinger band or trail.
 * When it buys and sells: buy when a closed bar's low touched the 20-day EMA
 * (within 0.5 ATR) AND price is above the 200-day average AND RSI(2) < 30.
 * Sell when a closed bar closes above the upper Bollinger band or the hard
 * 2.5-ATR stop is hit. An equity-drawdown circuit breaker halves position
 * size at 12% drawdown and blocks new entries at 22%.
 * When it does NOT work: in a downtrend the trend gate keeps us out (flat).
 * In a choppy range the EMA touch fires often with small moves and fees eat
 * the edge. Long-only.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  const n = closes.length;
  if (n < 220) return null;
  const prevClose = closes[n - 2];
  if (prevClose == null) return null;

  const ema20 = ctx.ema(20, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const bb = ctx.bb(20, 2, 1);
  if (ema20 == null || sma200 == null || atr == null || atr <= 0 || bb == null) return null;

  // equity drawdown circuit breaker — generic risk floor, same rationale as
  // the champion: a daily strategy should not draw down >12% in normal ops
  if (!ctx.state.eq || typeof ctx.state.eq !== 'object') ctx.state.eq = { posVal: {}, peak: 0, dd: 0 };
  const st = ctx.state.eq;
  const pos = ctx.position;
  st.posVal[sym] = pos * price;
  const equity = ctx.cash + Object.values(st.posVal).reduce((a, b) => a + b, 0);
  if (equity > st.peak) st.peak = equity;
  st.dd = st.peak > 0 ? (st.peak - equity) / st.peak : 0;
  let sizeMult = 0.5;
  if (st.dd > 0.12) sizeMult *= 0.5;
  if (st.dd > 0.22) sizeMult = 0;
  // --- end circuit breaker ---

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2.5 * atr;
    ctx.watch([
      { side: 'sell', price: bb.upper, trigger: 'above', note: 'upper band target' },
      { side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' }
    ]);
    // exit: close above upper band, or hard stop
    if (prevClose > bb.upper || price < stop) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // pullback: previous bar's LOW came within 0.5 ATR of the 20-EMA, in an uptrend
  const prevLow = ctx.low(1, 1);
  if (prevLow == null) return null;
  const touched = Math.abs(prevLow - ema20) < 0.5 * atr;
  const rsi2 = ctx.rsi(2, 1);
  if (touched && prevClose > sma200 && rsi2 != null && rsi2 < 30 && sizeMult > 0) {
    ctx.watch([{ side: 'sell', price: bb.upper, trigger: 'above', note: 'upper band target' },
               { side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 * sizeMult };
  }
  return null;
}
