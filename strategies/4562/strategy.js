/*
 * @coinsori-strategy v1
 * name: FearGreed Sentiment Regime SOL 1D
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Fear & Greed sentiment regime was validated on ETH 1D
 * (all 3 windows beat buy-and-hold) and generalized to BTC. SOL is a high-beta
 * asset where sentiment flips should swing price even harder, so the same
 * regime edge may be stronger here.
 * When it buys and sells: buys (full size) when Fear & Greed >= 55, sells when
 * it drops to <= 40, with a 25% hard stop-loss on every position.
 * When it does NOT work: the index is daily and slow — in a choppy range the
 * regime flips whipsaw; SOL's high beta means the 25% stop is hit harder and
 * faster than on ETH. The index only exists from Feb 2018.
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
    // 25% hard stop: caps the loss on any single position before the slow
    // daily sentiment index can confirm a regime flip.
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
