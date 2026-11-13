/*
 * @coinsori-strategy v1
 * name: SOL 4H Buy-the-Dip with Chandelier Trail (uptrend only)
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a confirmed uptrend, sharp dips are usually bought back quickly. Buying
 * those deep dips gives better entry prices than a plain trend filter (which buys after the
 * recovery is confirmed), and riding the bounce with a trailing stop captures more of the move
 * than selling at the mean. The EMA50>EMA200 gate keeps us out of bear markets where dips keep
 * falling.
 * When it buys and sells: Buy only when EMA50>EMA200, price is above the 200-SMA and the 20-bar
 * z-score of the close is below -2 (a real dip). Sell when the uptrend gate breaks, price closes
 * below the 200-SMA, price falls 3x ATR below entry (hard stop), or — once price has recovered
 * above the entry — a chandelier stop 3x ATR below the 20-bar high is hit.
 * When it does NOT work: In a slow grind higher with no sharp dips there are few trades; if a
 * real crash starts inside the uptrend the hard stop caps each loss but repeated knife-catches
 * add up. It also misses most of a steady melt-up because it waits for deep dips to buy.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const sma200 = ctx.sma(200, 1);
  const z = ctx.zscore(20, 1);
  const atr = ctx.atr(14, 1);
  const hh = ctx.high(20, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || sma200 == null || z == null || atr == null || hh == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }

  const uptrend = ema50 > ema200;
  const chandelier = hh - 3 * atr;

  if (ctx.position > 0) {
    // Hard stop: 3x ATR below entry caps a dip that turns into a crash.
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    // Chandelier trail only once it is above the entry (otherwise it would exit the dip we just bought).
    const trail = (ctx.entryPx != null && chandelier > ctx.entryPx) ? chandelier : null;
    ctx.watch([
      ...(trail != null ? [{ side: 'sell', price: trail, trigger: 'below', note: 'chandelier trail 3xATR' }] : []),
      { side: 'sell', price: sma200, trigger: 'below', note: 'crash gate SMA200' },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'hard stop 3xATR' }] : [])
    ]);
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (!uptrend || prevClose < sma200) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (trail != null && prevClose < trail) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // Flat: no new entries while the allocator is in reduce-only mode.
  if (ctx.alloc != null && ctx.alloc.status !== 'ok') {
    ctx.watch([]);
    return null;
  }
  if (uptrend && prevClose > sma200 && z <= -2) {
    ctx.watch([{ side: 'buy', price: ctx.sma(20, 1), trigger: 'below', note: 'dip below SMA20', conds: [{ label: 'zscore<-2', ok: z <= -2 }, { label: 'EMA50>EMA200', ok: true }] }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }

  ctx.watch([{ side: 'buy', price: ctx.sma(20, 1), trigger: 'below', note: 'waiting for dip', conds: [{ label: 'zscore<-2', now: z, op: '<', ref: -2, closed: true }, { label: 'EMA50>EMA200', ok: uptrend }] }]);
  return null;
}
