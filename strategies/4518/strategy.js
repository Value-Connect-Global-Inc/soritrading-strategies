/*
 * @coinsori-strategy v1
 * name: Fear-Greed Sentiment Regime (BNB 1D)
 * ex: binance
 * syms: BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed Index is crypto-wide sentiment. After the
 * sentiment-regime edge validated on BTC (4516) and ETH (4517), this tests the
 * same logic on BNB to confirm the edge is broad across major assets rather than
 * a BTC/ETH quirk. Same levels, no tuning.
 * When it buys and sells: buys when the index reaches 55 (greed); sells when it
 * drops to 40 (fear) or a 25% hard stop is hit.
 * When it does NOT work: sentiment lags price in fast crashes; BNB can be driven
 * by exchange-specific events that the crypto-wide index does not capture.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.75;
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
