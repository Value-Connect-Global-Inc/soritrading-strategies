/*
 * @coinsori-strategy v1
 * name: FearGreed Contrarian Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index is a crowd-sentiment gauge,
 * and crowds are most wrong at the extremes. When the crowd is in extreme
 * fear the panic is usually near its end and prices are cheap; when extreme
 * greed returns the easy money has been made. This is a CONTRARIAN bet — the
 * opposite direction of the momentum champion, so it diversifies the idea
 * space. It buys the panic on a 4-coin basket and sells the recovery.
 * When it buys and sells: on each asset, buy when the index is at extreme
 * fear (<= 20) AND price is above its 200-day average (only buy panic in an
 * uptrend, never a falling knife). Sell when the index recovers to >= 55 or
 * price rises 40% above entry, or if price drops 25% below entry (hard stop).
 * When it does NOT work: extreme fear can persist for a long time in a real
 * bear market — the 200-day filter helps but cannot catch every falling knife.
 * It also sits in cash for long stretches between panic events, so it misses
 * most of a steady bull.
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
      // Hard stop: 25% caps the loss on a panic that keeps falling.
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      // Take profit: the recovery target, then re-arm for the next panic.
      if (price >= entry * 1.40) return { side: 'sell', qty: pos };
      ctx.watch([
        { side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' },
        { side: 'sell', price: entry * 1.40, trigger: 'above', note: 'target: +40%' }
      ]);
    }
    // Crowd turned greedy again -> sell into the recovery.
    if (fg >= 55) return { side: 'sell', qty: pos };
    return null;
  }

  // Trend filter: only buy panic in an uptrend (price above 200-day average)
  // so we never catch a falling knife in a real bear market.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  if (fg <= 20 && price > sma200) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  ctx.watch([{
    side: 'buy',
    price: fg <= 20 ? sma200 : price,
    trigger: 'above',
    note: 'enter: extreme fear & trend up',
    conds: [{ label: 'F&G index', now: fg, op: '<=', ref: 20, closed: true }]
  }]);
  return null;
}
