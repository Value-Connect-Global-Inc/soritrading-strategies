/*
 * @coinsori-strategy v1
 * name: MultiAsset Mean Reversion BB/RSI 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the trend-following family has been explored exhaustively
 * in this environment; this is a different bet — that a sharp short-term selloff
 * inside an intact long-term uptrend mean-reverts. Buying the dip when RSI is
 * oversold and price is below the lower Bollinger band while price is still above
 * the 200-SMA has positive expectancy in liquid majors, and the hard stop limits
 * the damage when the dip is actually the start of a real breakdown.
 * When it buys and sells: buy when RSI(14) < 30 and the close is below the lower
 * Bollinger(20,2) band while price is above the 200-SMA (uptrend intact). Sell
 * when RSI recovers above 55 or price climbs back above the 20-SMA mid band, or
 * when the 2-ATR hard stop is hit. 12-bar cooldown after an exit.
 * When it does NOT work: in a genuine bear market the 200-SMA filter keeps it
 * mostly flat, but a fast V-shaped crash inside an uptrend (2020-03, 2021-05)
 * hits the stop repeatedly; in a slow grind lower that stays above the 200-SMA
 * it keeps catching falling knives and bleeds small losses.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (rsi == null || bb == null || bb.lower == null || bb.mid == null || sma200 == null || atr == null) return null;

  const sym = ctx.sym;
  const st = ctx.state || {};
  if (!st.cool) st.cool = {}; // per-symbol cooldown bar index after an exit

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    // Hard stop from entry; rebound exit when RSI recovers or price returns to mid band.
    const stopPx = entry != null ? entry - 2 * atr : price - 2 * atr;
    if (rsi >= 55 || price >= bb.mid || price <= stopPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop 2 ATR' }]);
    return null;
  }

  // Cooldown: wait 12 bars (2 days) after an exit so a stopped dip is not
  // re-bought into the same knife.
  const lastExit = st.cool[sym];
  if (lastExit != null && ctx.i - lastExit < 12) return null;

  // Only buy dips inside a long-term uptrend — the trend filter is what keeps a
  // falling market from feeding us a stream of losing mean-reversion buys.
  if (price <= sma200) return null;
  if (rsi >= 30 || price >= bb.lower) return null;

  // Size: risk a small fixed share of the per-symbol cash on the stop distance.
  // 1% per asset, same risk budget as the champion trend basket.
  const riskCash = ctx.cash * 0.01;
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
