/*
 * @coinsori-strategy v1
 * name: ETH 4H Bollinger MR RSI-Exit + 2ATR Stop
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH dips to the lower Bollinger band snap back, and the
 * snap-back often continues well past the middle band. Holding until RSI climbs
 * back above 60 captures the full recovery. A 2-ATR hard stop below entry caps
 * the damage on the rare dips that keep falling in the choppy 2022-24 regime.
 * When it buys and sells: it buys when price closes below the 20-bar lower
 * Bollinger band with RSI below 35 and price above the 200-bar average. It sells
 * when RSI climbs above 60, or cuts the position if price falls 2 ATR below entry.
 * Position size scales with how far price fell below the band.
 * When it does NOT work: in a strong melt-up it sits in cash and lags buy-and-hold
 * (defensive by design). A hard stop turns a temporary dip into a realized loss
 * right before a rebound, so it can hurt in fast V-shaped recoveries.
 *
 * 2025-04-11: display-only change — added ctx.watch declarations, trading logic unchanged.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const px = ctx.closes[ctx.closes.length - 2];
  if (bb == null || bb.lower == null || rsi == null || sma200 == null || atr == null || px == null) return null;

  if (ctx.position > 0) {
    const entry = ctx.entryPx || 0;
    if (entry > 0 && px < entry - 2 * atr) {
      ctx.watch([{ side: 'sell', price: entry - 2 * atr, trigger: 'below', note: '2ATR stop' }]);
      return { side: 'sell', qty: ctx.position };
    }
    if (rsi > 60) {
      ctx.watch([{ side: 'sell', price: entry - 2 * atr, trigger: 'below', note: '2ATR stop' },
                 { side: 'sell', price: 60, trigger: 'above', note: 'RSI exit', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }] }]);
      return { side: 'sell', qty: ctx.position };
    }
    ctx.watch([{ side: 'sell', price: entry - 2 * atr, trigger: 'below', note: '2ATR stop' },
               { side: 'sell', price: 60, trigger: 'above', note: 'RSI exit', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }] }]);
    return null;
  }

  if (px <= bb.lower && rsi < 35 && px > sma200) {
    const equity = ctx.cash + ctx.position * ctx.price;
    const bandDist = Math.max(bb.mid - bb.lower, atr);
    const qty = Math.max(0, Math.min((equity * 0.04) / bandDist, (ctx.cash / ctx.price) * 0.95));
    if (qty > 0) {
      ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower entry', conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true },
        { label: 'Close > SMA200', ok: px > sma200 }
      ] }]);
      return { side: 'buy', qty: qty };
    }
  }
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower entry', conds: [
    { label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true },
    { label: 'Close > SMA200', ok: px > sma200 }
  ] }]);
  return null;
}
