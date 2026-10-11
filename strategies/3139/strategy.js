/*
 * @coinsori-strategy v1
 * name: XRP 4H Trend-Gated Keltner Mean-Reversion
 * ex: binance
 * syms: XRPUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a confirmed uptrend (price above the 200-period average),
 * sharp drops down to a volatility band are usually overreactions that snap back
 * to the trend mean. This exact recipe (20-EMA minus 2.5x ATR, RSI<40 entry,
 * snap-back exit) has validated on BTC, ETH, ADA and SOL 4h; this build runs it
 * on XRP with no parameter changes, as a pure generalization test.
 * When it buys and sells: buys when the previous closed bar touched the lower
 * Keltner band AND RSI was below 40, but only while price sits above the 200-SMA;
 * sells when price snaps back up to the 20-EMA (band middle) or RSI recovers
 * above 55. A 2-bar cooldown after each trade cuts whipsaw.
 * When it does NOT work: in sustained bear markets (price below the 200-SMA) it
 * stays in cash, so it misses bear-market bounces; and in a slow bleed where
 * price grinds lower without snapping back it holds a losing position until the
 * 200-SMA regime gate turns off.
 * 2026-04-27 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Trend gate: only buy pullbacks while price is above the 200-SMA (bull regime).
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // Closed-bar indicators (ago=1) so the entry is identical in backtest and live.
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  if (ema20 == null || atr == null || rsi == null) return null;

  const lower = ema20 - 2.5 * atr; // 2.5x ATR: wide enough to avoid noise, tight enough to catch real flushes
  const closes = ctx.closes;
  const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
  if (prevClose == null) return null;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'snap-back to EMA20' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'regime gate' },
      { side: 'sell', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 55, closed: true }], note: 'RSI recovery' }
    ]);
  } else {
    ctx.watch([
      { side: 'buy', price: lower, trigger: 'below', note: 'Keltner lower band', conds: [
        { label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'Prev close > SMA200', ok: prevClose > sma200, closed: true },
        { label: 'Cooldown', ok: cd }
      ]}
    ]);
  }

  if (pos > 0) {
    // Exit: price reclaimed the 20-EMA, or RSI recovered, or regime turned bearish.
    if (price >= ema20 || rsi > 55 || price < sma200) {
      ctx.state.cd = 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Entry on a closed bar: touched the lower band while oversold, inside the bull regime.
  if (prevClose < lower && rsi < 40 && prevClose > sma200 && cd === 0) {
    ctx.state.cd = 2;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
