/*
 * @coinsori-strategy v1
 * name: FearGreed Sentiment + Trend Filter (ETH/USDT 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto Fear & Greed is a sentiment thermometer. Greed
 * (index >= 55) tends to continue in an uptrend; fear (<= 40) means the mood
 * has broken. Adding a 200-day trend filter stops us from buying greed during
 * bear-market rallies, which is the documented weakness of the pure sentiment
 * version.
 * When it buys and sells: buys (full size) when Fear & Greed >= 55 AND price is
 * above its 200-day average; sells when F&G drops to <= 40, with a 25% hard
 * stop-loss on every position.
 * When it does NOT work: the index is daily and slow, so in a choppy
 * range-bound market the regime flips produce whipsaws; if a new bull market
 * starts while price is still below the 200-day average we miss the first part
 * of the recovery. The index only exists from Feb 2018 — before that the
 * strategy sits in cash.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  // F&G data starts Feb 2018; null = unknown, do not trade on missing data.
  if (fg == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry == null) return null;
    // 25% hard stop: caps the loss on any single position before a regime
    // flip can be confirmed by the slow daily sentiment index.
    const stopPx = entry * 0.75;
    if (price <= stopPx) return { side: 'sell', qty: pos };

    // Exit when sentiment turns fearful (<=40). 40 chosen (not 50) so normal
    // pullbacks inside a greed regime do not throw us out early.
    if (fg <= 40) return { side: 'sell', qty: pos };

    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop: -25%' },
               { side: 'sell', note: 'exit: F&G <= 40',
                 conds: [{ label: 'Fear&Greed', now: fg, op: '>', ref: 40, closed: true }] }]);
    return null;
  }

  // 200-day trend filter: only buy greed when the long-term trend is up, so we
  // skip greed spikes that happen inside a bear market (dead-cat rallies).
  const trend = ctx.sma(200, 1);
  if (trend == null) return null;

  if (fg >= 55 && price > trend) {
    ctx.watch([{ side: 'buy', note: 'enter: F&G >= 55 & uptrend',
                 conds: [{ label: 'Fear&Greed', now: fg, op: '>=', ref: 55, closed: true },
                         { label: 'Price > SMA200', ok: price > trend }] }]);
    return { side: 'buy', qty: (ctx.cash * 0.95) / price };
  }

  ctx.watch([{ side: 'buy', note: 'enter: F&G >= 55 & uptrend',
               conds: [{ label: 'Fear&Greed', now: fg, op: '>=', ref: 55, closed: true },
                       { label: 'Price > SMA200', ok: price > trend }] }]);
  return null;
}
