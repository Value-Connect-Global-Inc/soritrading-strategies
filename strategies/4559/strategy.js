/*
 * @coinsori-strategy v1
 * name: FearGreed Sentiment Regime (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto Fear & Greed is a sentiment thermometer. When the
 * crowd is greedy (index >= 55) momentum tends to continue; when it turns
 * fearful (index <= 40) the mood has broken and it is time to leave. This is a
 * pure sentiment-regime system — no price breakout, no trend channel — a
 * different family from the Donchian champion.
 * When it buys and sells: buys (full size) when Fear & Greed >= 55, sells when
 * it drops to <= 40, with a 25% hard stop-loss on every position.
 * When it does NOT work: the index is daily and slow, so in a choppy
 * range-bound market the regime flips produce whipsaws; in a slow grinding
 * bear market the index can hover around the threshold and give false entries.
 * The index only exists from Feb 2018 — before that the strategy sits in cash.
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

  if (fg >= 55) {
    ctx.watch([{ side: 'buy', note: 'enter: F&G >= 55',
                 conds: [{ label: 'Fear&Greed', now: fg, op: '>=', ref: 55, closed: true }] }]);
    return { side: 'buy', qty: (ctx.cash * 0.95) / price };
  }

  ctx.watch([{ side: 'buy', note: 'enter: F&G >= 55',
               conds: [{ label: 'Fear&Greed', now: fg, op: '>=', ref: 55, closed: true }] }]);
  return null;
}
