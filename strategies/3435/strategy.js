/*
 * @coinsori-strategy v1
 * name: LINK BB Mean Reversion 4H
 * ex: binance
 * syms: LINK
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: LINK spends much more time ranging than BTC, and in a range prices snap back to the middle instead of trending. Buying a deep touch of the lower Bollinger band and selling back to the middle band harvests that snap-back.
 * When it buys and sells: Buys when the closed bar closes below the lower Bollinger band (20, 2.0) while RSI(14) is below 35 (oversold). Sells when price crosses back up through the middle band, after 20 bars, or on a 5% stop loss.
 * When it does NOT work: In a strong sustained downtrend, every "oversold" dip keeps falling — the 5% stop limits per-trade damage but repeated stops stack up. Also when LINK trends hard upward, we never get a chance to buy the dips.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2.0, 1);           // Bollinger bands of the CLOSED bar
  if (bb == null || bb.lower == null || bb.mid == null) return null;
  const rsi = ctx.rsi(14, 1);              // RSI of the closed bar
  if (rsi == null) return null;
  const prevClose = ctx.closes.at(-2);

  // --- exits ---
  if (ctx.position > 0) {
    const entry = ctx.state.entry != null ? ctx.state.entry : prevClose;
    const barsHeld = (ctx.state.barsHeld || 0) + 1;
    ctx.state.barsHeld = barsHeld;
    // exit on middle-band touch, max 20 bars (~3 days), or 5% stop — each caps a distinct risk
    if (prevClose >= bb.mid || barsHeld >= 20 || prevClose < entry * 0.95) {
      ctx.state.entry = null;
      ctx.state.barsHeld = 0;
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  // --- entry: closed bar below lower band AND oversold RSI ---
  if (prevClose < bb.lower && rsi < 35) {
    ctx.state.entry = prevClose;
    ctx.state.barsHeld = 0;
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
