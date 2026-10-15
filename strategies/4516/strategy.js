/*
 * @coinsori-strategy v1
 * name: Fear-Greed Sentiment Regime v2 (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment is a slow-moving regime, not daily noise.
 * The Fear & Greed Index spends most of a bull market in "greed" territory
 * (>=55) and most of a bear market in "fear" (<=40). Riding those zones is a
 * sentiment-momentum bet on a completely different signal source than price or
 * hashrate.
 * When it buys and sells: buys when the index reaches 55 (greed); sells when it
 * drops to 40 (fear) or a 25% hard stop is hit (risk cap per position). The
 * 55/40 gap is a hysteresis band that filters out whipsaw in the neutral zone.
 * When it does NOT work: sentiment lags price in fast V-shaped crashes — the
 * index turns fearful only after price has already fallen, so it cannot time an
 * exit at the top. In long sideways chop the index can sit in the 40-55 band,
 * keeping the strategy flat and missing range rallies.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null;   // unknown sentiment = stay flat, never assume

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.75;   // hard stop 25% below entry: cap single-position damage
    if (price <= stop) return { side: 'sell', qty: pos };
    if (fg <= 40) return { side: 'sell', qty: pos };   // sentiment turned fearful
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '25% stop' },
               { side: 'sell', price: 40, trigger: 'below', note: 'exit: F&G <= 40',
                 conds: [{ label: 'F&G index', now: fg, op: '<=', ref: 40, closed: true }] }]);
    return null;
  }

  const enter = fg >= 55;   // greed zone = crowd is bullish, ride the regime
  ctx.watch([{ side: 'buy', price: 55, trigger: 'above', note: 'enter: F&G >= 55',
               conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 55, closed: true }] }]);
  if (!enter) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
