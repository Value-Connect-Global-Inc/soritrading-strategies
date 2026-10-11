/*
 * @coinsori-strategy v1
 * name: BTC 4H BB Squeeze Breakout
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: markets alternate between low-volatility (squeeze) and
 *   high-volatility states. A squeeze — Bollinger band width at a 200-bar low —
 *   is followed by an expansion, and the first close beyond the upper band
 *   usually starts a leg we can ride. We only take the upside resolution.
 * When it buys and sells: buy when the BB(20,2) width is at/near its 200-bar
 *   minimum AND price closes above the upper band; sell when price closes back
 *   below the 20-EMA or on a 2x ATR stop from entry.
 * When it does NOT work: when the squeeze resolves DOWNWARD (long-only stops
 *   out on every down-breakout) and in long chop where the band repeats. It
 *   misses down-breakouts entirely. Many squeeze signals are false and the
 *   2x ATR stop takes the loss.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2, 1);   // band of last closed bar
  const atr = ctx.atr(14, 1);
  const ema20 = ctx.ema(20, 1);
  if (bb == null || atr == null || ema20 == null || atr <= 0) return null;
  if (!Number.isFinite(bb.upper) || !Number.isFinite(bb.lower) || bb.upper <= bb.lower) return null;

  const middle = (bb.upper + bb.lower) / 2;
  const width = (bb.upper - bb.lower) / middle;

  if (!ctx.state.widthHist) ctx.state.widthHist = [];
  ctx.state.widthHist.push(width);
  if (ctx.state.widthHist.length > 200) ctx.state.widthHist.shift();

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 2 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };   // hard stop
    if (price < ema20) return { side: 'sell', qty: pos };     // expansion faded
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' },
               { side: 'sell', price: ema20, trigger: 'below', note: 'fade exit' }]);
    return null;
  }

  if (ctx.state.widthHist.length < 200) return null;
  const minWidth = Math.min(...ctx.state.widthHist);
  const squeezed = width < minWidth * 1.05;  // current width near the 200-bar low
  if (!squeezed) return null;
  if (price <= bb.upper) return null;   // need a close above the upper band

  const riskCash = ctx.cash * 0.01;      // 1% equity risked per trade
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap position at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
