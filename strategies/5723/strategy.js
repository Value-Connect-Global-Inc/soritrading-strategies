/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend + Vol-Target + 2Bar Confirm 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Champion 5714 (SMA200 trend + vol-target sizing) is this
 * job's best strategy, but its small whipsaw losses happen when it buys the
 * first green close above the 200-day average inside a sideways chop. This
 * version keeps every signal, exit and size rule and only adds ONE change:
 * it waits for TWO consecutive closes above the 200-day average before
 * buying, so a single dead-cat bounce does not trigger an entry. Exits are
 * unchanged (close below the 200-day average).
 * When it buys and sells: Buys after 2 consecutive closes above the 200-day
 * average, sized as min(1, 3%/ATR20%) of cash. Sells when the close falls
 * below the 200-day average. No other exits.
 * When it does NOT work: The extra confirmation bar delays entries into sharp
 * V-shaped recoveries, so it can buy slightly higher after a fast bottom. It
 * still whipsaws in long sideways ranges, just with fewer entries.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const atr20 = ctx.atr(20, 1);
  if (sma200 == null || atr20 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  const above = prevClose > sma200;

  // count consecutive closes above the 200-day average (restart-safe state)
  const state = ctx.state || {};
  const barsAbove = above ? (state.barsAbove || 0) + 1 : 0;
  ctx.state = { barsAbove: barsAbove };

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: '2nd close above SMA200' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200' }
  ]);

  if (pos > 0) {
    if (prevClose < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // allocation engine must be healthy before opening new positions
  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  // need 2 consecutive closes above the 200-day average, not just the first bounce
  if (above && barsAbove >= 2) {
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct);
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
