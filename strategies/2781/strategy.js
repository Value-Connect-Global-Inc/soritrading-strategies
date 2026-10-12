/*
 * @coinsori-strategy v1
 * name: ROC Pullback Mean Reversion BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: After a sharp short-term selloff inside a rising longer
 * bull trend, prices tend to snap back (mean reversion). We bet on that
 * snap-back rather than on riding the trend.
 * When it buys and sells: buys when the 10-day rate-of-change is deeply
 * negative (a sharp pullback) AND the RSI is oversold, while the 200-day
 * average is still rising (confirmed bull); sells when price recovers to the
 * 20-day average or the 200-day trend rolls over, with a hard stop at 3x ATR.
 * When it does NOT work: in a sustained bear market the pullback keeps
 * falling (the rising-200-SMA gate blocks most but not all); and it lags
 * strong V-shaped recoveries where price jumps back before the RSI dips.
 * 
 * 2025-01-01: display-only change — added ctx.watch declarations, no trading logic changed.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Trend gate: 200-SMA must be RISING (confirmed bull), not just price above it.
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (sma200 == null || sma200prev == null) return null;
  if (sma200 <= sma200prev) return null; // no mean-reversion entries in a downtrend

  const sma20 = ctx.sma(20, 1);
  if (sma20 == null) return null;

  // Rate of change over 10 bars (closed bars, ago>=1 semantics).
  const p10 = ctx.closes[ctx.closes.length - 11];
  if (p10 == null || p10 <= 0) return null;
  const roc10 = (price - p10) / p10 * 100;

  const rsi = ctx.rsi(14, 1);
  if (rsi == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  const st = ctx.state;

  if (pos > 0) {
    const stopPx = st.stopPx || (ctx.entryPx - 3 * atr);
    // Exit on hard stop, trend rollover, or recovery to the 20-day average.
    ctx.watch([
      { side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop 3x ATR' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'trend rollover' },
      { side: 'sell', price: sma20, trigger: 'above', note: 'recovery to SMA20' },
      { side: 'sell', price: stopPx, trigger: 'below', note: 'trailing stop', conds: [
        { label: 'SMA200 rising', ok: sma200 > sma200prev, closed: true },
        { label: 'ROC(10) close', now: roc10, op: '>', ref: -12, closed: true }
      ]}
    ]);
    if (price <= stopPx || price < sma200 || price >= sma20) {
      ctx.state.stopPx = null;
      return { side: 'sell', qty: pos };
    }
    ctx.state.stopPx = stopPx;
    return null;
  }

  // Deep pullback (10-day ROC <= -12%) + oversold RSI, inside a rising bull.
  // 12% + RSI<35 filters out shallow noise, keeping only real dips.
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'bull trend confirm', conds: [
      { label: 'ROC(10) close', now: roc10, op: '<=', ref: -12, closed: true },
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true },
      { label: 'SMA200 rising', ok: sma200 > sma200prev, closed: true }
    ]}
  ]);
  if (roc10 <= -12 && rsi < 35 && price > sma200) {
    ctx.state.stopPx = price - 3 * atr;
    return { side: 'buy', qty: ctx.cash / price * 0.5 };
  }
  return null;
}
