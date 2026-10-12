/*
 * @coinsori-strategy v1
 * name: FearGreedContrarian
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto is driven by sentiment cycles. When the Fear & Greed
 * index hits extreme fear it marks a local pessimism peak — historically a good
 * entry; extreme greed marks euphoria peaks — historically a good exit. This bets
 * on sentiment mean-reversion rather than price trend.
 * When it buys and sells: buys when the index falls below 20 (extreme fear),
 * sells when it rises above 75 (extreme greed) or on a hard -20% stop-loss.
 * When it does NOT work: in a prolonged bear market extreme fear keeps getting
 * more extreme — buying the first fear spike in a real crash loses; in a
 * relentless bull the greed exit sells too early. It needs sentiment to revert.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const fg = ctx.data('fear_greed'); // 0-100 sentiment index
  if (fg == null) return null;
  const pos = ctx.position;

  if (pos > 0) {
    const hardStop = ctx.entryPx * 0.80; // -20% cap: sentiment can stay extreme, limit the damage
    if (fg >= 75 || price <= hardStop) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '-20% stop' },
               { side: 'sell', price: 75, trigger: 'above', note: 'greed exit' }]);
    return null;
  }

  if (fg < 20) {
    // Extreme fear = crowd capitulation, historically a local bottom. 60% size
    // because a sentiment trade can always be wrong — never full risk on.
    ctx.watch([{ side: 'sell', price: ctx.entryPx * 0.80, trigger: 'below', note: '-20% stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.6 };
  }
  ctx.watch([{ side: 'buy', price: 20, trigger: 'below', note: 'extreme fear entry' }]);
  return null;
}
