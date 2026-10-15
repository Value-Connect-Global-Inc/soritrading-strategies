/*
 * @coinsori-strategy v1
 * name: FearGreed Multi-Asset Regime Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Fear & Greed sentiment regime is the one edge that
 * held up on every asset tested (BTC, ETH, SOL). Running it as a 4-asset
 * basket keeps that edge while diversifying single-coin crash risk.
 * When it buys and sells: each coin is bought (25% of cash) when Fear & Greed
 * >= 55, sold when it drops to <= 40, with a 25% hard stop-loss on each.
 * When it does NOT work: the index is daily and slow - choppy ranges whipsaw
 * the regime; a coin-specific crash can still hit the 25% stop before the
 * index turns. The index only exists from Feb 2018.
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
    // 25% of cash per coin so a 4-asset basket deploys ~100% when all fire.
    const qty = (ctx.cash * 0.25 * 0.95) / price;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'enter: F&G >= 55',
                 conds: [{ label: 'Fear&Greed', now: fg, op: '>=', ref: 55, closed: true }] }]);
    return { side: 'buy', qty };
  }

  ctx.watch([{ side: 'buy', note: 'enter: F&G >= 55',
               conds: [{ label: 'Fear&Greed', now: fg, op: '>=', ref: 55, closed: true }] }]);
  return null;
}
