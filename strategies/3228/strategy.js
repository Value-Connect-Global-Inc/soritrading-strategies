/*
 * @coinsori-strategy v1
 * name: XRP 4H Squeeze Breakout
 * ex: binance
 * syms: XRPUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: volatility squeezes (tight ranges) often resolve with a
 * sharp directional move. This bets that an upward resolution of a squeeze is
 * the start of a new short-term trend.
 * When it buys and sells: buys when price breaks above the highest high of the
 * last 20 bars while volatility is compressed (14-bar ATR below the 50-bar ATR)
 * and MACD is above its signal. Sells when price closes back below the lowest
 * low of the last 20 bars (trailing stop).
 * When it does NOT work: in a sideways chop where every breakout is a fake-out,
 * and in a slow grind down where the 20-bar low stop is hit repeatedly. It is
 * long-only, so sustained bear markets lose.
 */
// 2026-04-26 표시만 바뀜, 매매 판단은 그대로
function onUpdate(ctx) {
  const pos = ctx.position;
  const close = ctx.price;

  const hh20 = ctx.high(20, 1);   // highest high of last 20 CLOSED bars
  const ll20 = ctx.low(20, 1);    // lowest low of last 20 CLOSED bars
  const atrF = ctx.atr(14, 1);
  const atrS = ctx.atr(50, 1);
  const macd = ctx.macd(12, 26, 9, 1);
  if (hh20 == null || ll20 == null || atrF == null || atrS == null || macd == null) {
    ctx.watch([]);
    return null;
  }

  // Exit: close back below the 20-bar low (trailing stop).
  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: ll20, trigger: 'below', note: '20-bar low stop' }]);
    if (close < ll20) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Squeeze: 14-bar ATR below 50-bar ATR = volatility contracting.
  const squeeze = atrF < atrS;
  const macdUp = (macd.macd != null && macd.signal != null) ? macd.macd > macd.signal : false;

  ctx.watch([{
    side: 'buy',
    price: hh20,
    trigger: 'above',
    note: '20-bar high breakout',
    conds: [
      { label: 'ATR(14) < ATR(50)', ok: squeeze, closed: true },
      { label: 'MACD > signal', ok: macdUp, closed: true }
    ]
  }]);

  if (pos === 0 && close > hh20 && squeeze && macdUp) {
    const risk = ctx.cash * 0.02;                      // risk 2% of equity per trade
    const stopDist = Math.max(close - ll20, atrS * 1.5); // stop at 20-bar low, min 1.5 ATR
    const qty = Math.min(risk / stopDist, ctx.cash / close * 0.99);
    return { side: 'buy', qty };
  }
  return null;
}
