/*
 * @coinsori-strategy v1
 * name: FearGreed Regime Basket v8 StopCooldown
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index is a crowd-sentiment gauge and
 * momentum persists in crypto: when the crowd is greedy (index >= 55) prices
 * keep climbing, and when the crowd turns fearful (index <= 40) the trend has
 * broken. This rides confirmed sentiment on a 4-coin basket. v8 adds a
 * re-entry cooldown: after a -25% stop-out, that asset is usually still falling,
 * so it refuses to re-buy it for 30 days — a standard 'do not re-buy a falling
 * asset' risk rule, not a fitted filter.
 * When it buys and sells: on each asset, buy when Fear & Greed >= 55 AND price is
 * above its 200-day average AND the Fed is not hiking. Sell when price drops
 * 25% below entry (hard stop) or the sentiment index falls to <= 40.
 * When it does NOT work: in a fast crash the index lags price, and the 25% stop
 * turns a normal dip into a realized loss. It misses the very start of a bull
 * because it waits for confirmed greed, and a 30-day cooldown can make it miss
 * a sharp V-recovery right after a shakeout.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = Number(ctx.data('fg'));
  if (!Number.isFinite(fg)) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 25% hard stop: caps the loss on any single position.
      if (price <= entry * 0.75) {
        // v8: remember when we stopped out so we can enforce the cooldown.
        ctx.state = { stopBar: ctx.i };
        return { side: 'sell', qty: pos };
      }
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    if (fg <= 40) return { side: 'sell', qty: pos }; // greed over -> exit
    return null;
  }

  // v8: re-entry cooldown — after a -25% stop, that asset is usually still
  // falling; do not re-buy it for 30 days. Standard risk rule.
  if (ctx.state && Number.isFinite(ctx.state.stopBar) && ctx.i - ctx.state.stopBar < 30) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const fed = Number(ctx.data('fed'));
  const fedLag = Number(ctx.data('fed_lag30'));
  const fedHiking = Number.isFinite(fed) && Number.isFinite(fedLag) && fed > fedLag;

  if (fg >= 55 && price > sma200 && !fedHiking) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  ctx.watch([{
    side: 'buy',
    price: fg >= 55 ? sma200 : price,
    trigger: 'above',
    note: 'enter: greed>=55 & trend up & fed ok',
    conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 55, closed: true },
           { label: 'Fed not hiking', ok: !fedHiking }]
  }]);
  return null;
}
