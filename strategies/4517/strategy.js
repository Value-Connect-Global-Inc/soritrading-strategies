/*
 * @coinsori-strategy v1
 * name: Fear-Greed Sentiment Regime (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed Index is crypto-wide sentiment, and ETH
 * trades heavily on the same crowd emotion as BTC. This tests whether the
 * sentiment-regime edge validated on BTC (strategy 4516) generalizes to ETH,
 * or whether it is BTC-specific. Same logic, same levels.
 * When it buys and sells: buys when the index reaches 55 (greed); sells when it
 * drops to 40 (fear) or a 25% hard stop is hit. The 55/40 gap is a hysteresis
 * band that filters out whipsaw in the neutral zone.
 * When it does NOT work: sentiment lags price in fast V-shaped crashes, and ETH
 * is more volatile than BTC so the 25% stop is more likely to trigger. In chop
 * the index sits in the 40-55 band, keeping the strategy flat.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null;   // unknown sentiment = stay flat, never assume

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.75;   // hard stop 25% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (fg <= 40) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '25% stop' },
               { side: 'sell', price: 40, trigger: 'below', note: 'exit: F&G <= 40',
                 conds: [{ label: 'F&G index', now: fg, op: '<=', ref: 40, closed: true }] }]);
    return null;
  }

  const enter = fg >= 55;
  ctx.watch([{ side: 'buy', price: 55, trigger: 'above', note: 'enter: F&G >= 55',
               conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 55, closed: true }] }]);
  if (!enter) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
