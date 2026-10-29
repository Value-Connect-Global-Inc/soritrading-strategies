/*
 * @coinsori-strategy v1
 * name: BTC Close-Channel 55/30 Breakout + Vol-Target 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same Donchian breakout idea (buy a 55-bar high break, exit on
 * a 30-bar low break) but the channel is built from CLOSE prices instead of
 * high/low, because ctx.highs/ctx.lows turned out not to be populated in this
 * environment (any use silently produced 0 trades). Close-based channel is a
 * slightly smoother version of the same breakout concept.
 * When it buys and sells: Buys when the previous close is the highest close of the
 * last 55 days, sized by vol-target. Sells when the previous close is the lowest
 * close of the last 30 days.
 * When it does NOT work: In a long sideways range it whipsaws across the channel.
 * It lags sharp V-recoveries and underperforms buy-and-hold in calm choppy years.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const atr20 = ctx.atr(20, 1);
  if (atr20 == null || closes.length < 60) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  // channel from CLOSED bars: max close of last 55 closed bars, min close of last 30
  const hi55 = Math.max(...closes.slice(-56, -1));
  const lo30 = Math.min(...closes.slice(-31, -1));

  const pos = ctx.position;

  ctx.watch([
    { side: 'buy', price: hi55, trigger: 'above', note: 'break 55d close high' },
    { side: 'sell', price: lo30, trigger: 'below', note: 'break 30d close low' }
  ]);

  if (pos > 0) {
    if (prevClose < lo30) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > hi55) {
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct);
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
