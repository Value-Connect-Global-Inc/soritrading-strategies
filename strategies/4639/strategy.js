/*
 * @coinsori-strategy v1
 * name: BTC Bollinger Squeeze Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Markets alternate between quiet consolidation (squeeze)
 * and expansion. A Bollinger squeeze means volatility is compressed; when price
 * breaks out of the compressed bands, a directional move often follows. Buying
 * an upward break out of a squeeze catches the start of the expansion.
 * When it buys and sells: buy when the Bollinger band width is at its lowest
 * in 100 bars (squeeze) AND the last closed bar closed above the upper band
 * (upward break). Sell below the 20-SMA, or a 12% hard stop.
 * When it does NOT work: many squeeze breaks are false — price pops above the
 * band and immediately reverts, so it whipsaws in a ranging market. It also
 * misses slow grind-ups that never squeeze first, and the 12% stop is wide in
 * a fast crash.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 160) return null;
  const prevClose = c.at(-2);

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.88;   // hard stop 12% below entry
    const sma20 = ctx.sma(20, 1);
    if (price <= stop) return { side: 'sell', qty: pos };
    if (sma20 != null && prevClose < sma20) return { side: 'sell', qty: pos };   // momentum failed
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '12% stop' },
               { side: 'sell', price: sma20, trigger: 'below', note: 'below 20-SMA' }]);
    return null;
  }

  // Squeeze: current band width is the minimum of the last 100 closed bars
  const bbNow = ctx.bb(20, 2, 1);
  if (bbNow == null || !Number.isFinite(bbNow.upper) || !Number.isFinite(bbNow.lower)) return null;
  const widthNow = bbNow.upper - bbNow.lower;
  let minWidth = Infinity;
  for (let k = 2; k <= 101; k++) {
    const bb = ctx.bb(20, 2, k);
    if (bb == null || !Number.isFinite(bb.upper) || !Number.isFinite(bb.lower)) continue;
    const w = bb.upper - bb.lower;
    if (w < minWidth) minWidth = w;
  }
  if (!(widthNow <= minWidth)) return null;   // must be the tightest squeeze
  if (!(prevClose > bbNow.upper)) return null;   // upward break out of the band

  ctx.watch([{ side: 'buy', price: bbNow.upper, trigger: 'above', note: 'squeeze break up',
               conds: [{ label: 'band at 100-bar min', ok: widthNow <= minWidth, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
