/*
 * @coinsori-strategy v1
 * name: ADA Keltner MR 4H Trend-Gated + Stop
 * ex: binance
 * syms: ADAUSDT
 * interval: 4h
 * cash: 10000
 * 2025-02-27 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: The 200-SMA trend-gated Keltner mean-reversion already cut ADA's
 * drawdown in half and beat buy-and-hold on all windows, but the recent 2024-26 window
 * still lost ~10% because some pullback positions kept falling with no stop. This version
 * adds a hard stop 1.5x ATR below the entry price to cap the losers, while keeping the
 * mid-band exit for winners.
 * When it buys and sells: buys when price closes below EMA20 minus 2.5x ATR, RSI(14)<40,
 * and price above the 200-SMA (uptrend only). Sells when price recovers above the 20-EMA
 * OR drops 1.5x ATR below the entry price (stop). 2-bar cooldown cuts whipsaw.
 * When it does NOT work: in a straight-line melt-up it lags buy-and-hold; the stop can
 * whipsaw out of a position that would have recovered, so it may exit a few bars early.
 * Defensive pullback strategy, not a chaser.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (ema20 == null || atr == null || atr <= 0 || rsi == null || sma200 == null) { ctx.watch([]); return null; }

  const pos = ctx.position;
  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  st.cd = cd;

  if (pos > 0) {
    // Stop-loss: 1.5x ATR below entry, fixed at entry time (stored in state).
    // 1.5x chosen because 2.5x ATR is the entry depth; this caps a losing trade
    // at roughly the size of the expected winning move, keeping risk symmetric.
    let stop = st.stop;
    if (stop == null || !Number.isFinite(stop)) {
      stop = ctx.entryPx - 1.5 * ctx.atr(14, 1);
      st.stop = stop;
    }
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' },
      { side: 'sell', price: ema20, trigger: 'above', note: 'mid-band exit', conds: [{ label: 'cooldown', ok: cd === 0 }] }
    ]);
    if (price <= stop) {
      st.cd = 2;
      st.stop = null;
      return { side: 'sell', qty: pos };
    }
    // Exit once price recovers above the 20-EMA (channel mid).
    if (price > ema20 && cd === 0) {
      st.cd = 2;
      st.stop = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const keltnerLow = ema20 - 2.5 * atr; // 2.5 ATR below EMA20 = volatility-adaptive lower band
  // 200-SMA trend gate: only buy pullbacks in an uptrend, to avoid bear-market knives
  ctx.watch([
    { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner buy', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'Close > SMA200', now: price, op: '>', ref: sma200, closed: true },
      { label: 'cooldown', ok: cd === 0 }
    ] }
  ]);
  if (price < keltnerLow && rsi < 40 && price > sma200 && cd === 0) {
    st.cd = 2;
    st.stop = null;
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
