/*
 * @coinsori-strategy v1
 * name: BTC 4H Momentum Breakout
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends hard in bull phases. A breakout above the
 *   prior 50-bar high with above-average volume marks the start of a leg we
 *   ride with a moving-average trailing exit and a hard ATR stop.
 * When it buys and sells: buy when price closes above the prior 50-bar high
 *   AND volume is above 1.3x its 50-bar average; sell when price closes back
 *   below the 20-bar EMA or hits a 2x ATR stop from entry.
 * When it does NOT work: long chop/range regimes produce false breakouts
 *   that stop out — the strategy bleeds slowly. It also gives back part of
 *   every trend to the trailing exit.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const high = ctx.high(50, 1);        // breakout level: highest high of prior 50 bars
  const ema = ctx.ema(20, 1);          // trailing exit reference
  const atr = ctx.atr(14, 1);
  const vol = ctx.vol;
  const avgVol = ctx.avgVol(50);
  if (high == null || ema == null || atr == null || vol == null || avgVol == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 2 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };   // hard stop
    if (price < ema) return { side: 'sell', qty: pos };       // momentum broken
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' },
               { side: 'sell', price: ema, trigger: 'below', note: 'momentum exit' }]);
    return null;
  }

  if (price <= high) return null;        // need a fresh breakout
  if (vol <= 1.3 * avgVol) return null;  // no volume = likely false breakout

  const riskCash = ctx.cash * 0.01;      // 1% equity risked per trade
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap position at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
