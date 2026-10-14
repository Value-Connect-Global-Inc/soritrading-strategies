/*
 * @coinsori-strategy v1
 * name: Fear-Greed Extreme-Fear MR BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed index measures crowd emotion
 * (0 = extreme fear, 100 = extreme greed). Crowds are wrong at the extremes:
 * extreme fear marks panic-selling exhaustion, which historically has been a
 * good long entry for Bitcoin; extreme greed marks euphoria worth taking
 * profit into. This is a pure sentiment mean-reversion play.
 * When it buys and sells: buys when the Fear & Greed index is below 20
 * (extreme fear). Sells when the index rises above 65 (greed), or a 2.5x ATR
 * hard stop is hit. Each trade risks 2% of cash.
 * When it does NOT work: in a prolonged bear market fear can stay below 20
 * for months — the strategy buys early and bleeds through repeated stops;
 * and it is long-only mean-reversion, so it never profits from a steady rally
 * that never gets fearful. It needs the Fear & Greed data (starts 2018-02).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  // Crowd sentiment: 0 (extreme fear) .. 100 (extreme greed)
  const fgRaw = ctx.data('fear_greed');
  const fg = fgRaw == null ? null : Number(fgRaw);
  const fgOk = fg != null && Number.isFinite(fg);

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2.5 * atr;   // hard stop: 2.5x daily ATR below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    const greedy = fgOk && fg > 65;         // take the mean-reversion profit into greed
    if (greedy) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: 65, trigger: 'above', note: 'greed exit',
                 conds: [{ label: 'F&G index', now: fgOk ? fg : null, op: '>', ref: 65, closed: true }] }]);
    return null;
  }

  const panic = fgOk && fg < 20;            // buy extreme crowd fear only
  ctx.watch([{ side: 'buy', price: 20, trigger: 'below', note: 'extreme fear entry',
               conds: [{ label: 'F&G index', now: fgOk ? fg : null, op: '<', ref: 20, closed: true }] }]);
  if (!panic) return null;

  const riskCash = ctx.cash * 0.02;         // risk 2% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
