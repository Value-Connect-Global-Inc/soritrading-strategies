/*
 * @coinsori-strategy v1
 * name: BTC 4H Keltner MR with Hard Stop
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 * 2026-04-26 — 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: The trend-gated Keltner mean-reversion recipe (20-EMA minus
 * 2.5x ATR, RSI<40 entry, snap-back exit, 200-SMA bull gate) has validated on
 * BTC 4h across disjoint windows. This build adds ONE new element the previous
 * tests never tried: a hard stop-loss 1.5x ATR below the entry, to cap the
 * "slow bleed" case where price grinds lower without snapping back.
 * When it buys and sells: buys when the previous closed bar touched the lower
 * Keltner band while RSI<40 and price is above the 200-SMA; sells when price
 * snaps back to the 20-EMA, or RSI>55, or price falls below the 200-SMA, or the
 * hard stop (entry - 1.5x ATR) is hit.
 * When it does NOT work: in sustained bear markets it stays in cash and misses
 * bear-market rallies; the hard stop turns small drawdowns into realized losses
 * in choppy noise, so it can underperform the pure snap-back version when flushes
 * are shallow but frequent.
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

  const lower = ema20 - 2.5 * atr; // band width: wide enough to skip noise, tight enough to catch real flushes
  const closes = ctx.closes;
  const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
  if (prevClose == null) return null;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    const stop = st.stop != null ? st.stop : price - 1.5 * atr;
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' },
      { side: 'sell', price: ema20, trigger: 'above', note: 'snap-back to EMA20' }
    ]);
    // Exit: hard stop hit, snap-back, RSI recovery, or regime turned bearish.
    if (price <= stop || price >= ema20 || rsi > 55 || price < sma200) {
      ctx.state.cd = 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: lower, trigger: 'below', note: 'Keltner lower band',
      conds: [
        { label: 'RSI(14) closed', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'close > SMA200', now: prevClose, op: '>', ref: sma200, closed: true },
        { label: 'cooldown done', ok: cd === 0 }
      ] }
  ]);

  // Entry on a closed bar: touched the lower band while oversold, inside the bull regime.
  if (prevClose < lower && rsi < 40 && prevClose > sma200 && cd === 0) {
    ctx.state.cd = 2;
    st.stop = price - 1.5 * atr; // hard stop 1.5x ATR below entry, set once at entry
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
