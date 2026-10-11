/*
 * @coinsori-strategy v1
 * name: BTC RSI2 Ultra-Short MR 4H
 * ex: binance
 * syms: BTC
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: After a sharp short-term selloff, BTC frequently bounces back — a very short RSI(2) flags those oversold moments. Bounces play out over a few 4h bars, so we hold only a day or two.
 * When it buys and sells: Buys when RSI(2) on the closed bar is below 8 (deeply oversold). Sells when RSI(2) rises above 92, after 12 bars, or on a 3% stop loss.
 * When it does NOT work: Sustained downtrends where every oversold bounce keeps failing — the 3% stop limits damage but trades are losers. Fees (0.1% per side) eat into small bounces, so it needs real moves to pay.
 */
function onUpdate(ctx) {
  const rsi2 = ctx.rsi(2, 1);            // closed-bar RSI(2), identical live/backtest
  if (rsi2 == null) return null;
  const prevClose = ctx.closes.at(-2);

  // --- exits ---
  if (ctx.position > 0) {
    const entry = ctx.state.entry != null ? ctx.state.entry : prevClose;
    const barsHeld = (ctx.state.barsHeld || 0) + 1;
    ctx.state.barsHeld = barsHeld;
    // 92 overbought, 12-bar max hold (~2 days), 3% stop — each caps a distinct risk
    if (rsi2 > 92 || barsHeld >= 12 || prevClose < entry * 0.97) {
      ctx.state.entry = null;
      ctx.state.barsHeld = 0;
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  // --- entry: deeply oversold on the closed bar ---
  if (rsi2 < 8) {
    ctx.state.entry = prevClose;
    ctx.state.barsHeld = 0;
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
