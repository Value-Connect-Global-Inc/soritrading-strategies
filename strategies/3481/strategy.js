/*
 * @coinsori-strategy v1
 * name: Fear Greed Contrarian Reversion
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Extreme market sentiment (fear or greed) often marks local tops or bottoms, providing a robust contrarian edge when combined with momentum filters.
 * When it buys and sells: Buys when Fear & Greed is in extreme fear (< 25) and RSI is oversold; sells when Fear & Greed reaches greed (> 75) or RSI becomes overbought.
 * When it does not work: Fails during strong structural bull trends where extreme greed persists for weeks, or severe bear markets where fear remains indefinitely without a bounce.
 */

function onUpdate(ctx) {
  // Read Fear & Greed external dataset
  const fg = ctx.data('fg');
  if (fg == null) return null;

  // Read RSI and check warm-up
  const rsi = ctx.rsi(14, 0);
  const rsiPrev = ctx.rsi(14, 1);
  if (rsi == null || rsiPrev == null) return null;

  // Position control
  const pos = ctx.position;
  const cash = ctx.cash;
  const price = ctx.price;

  // Buy condition: Extreme fear (< 30) and RSI crossing up from oversold (< 35)
  if (pos <= 0 && fg < 30 && rsiPrev < 35 && rsi > 35) {
    const qty = (cash / price) * 0.99;
    ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'FG Extreme Fear + RSI Rebound', conds: [
      { label: 'FG', now: fg, op: '<', ref: 30, closed: true },
      { label: 'RSI', now: rsi, op: '>', ref: 35, closed: false }
    ]}]);
    return { side: 'buy', qty: qty };
  }

  // Sell condition: Extreme greed (> 75) or RSI overbought (> 70)
  if (pos > 0 && (fg > 75 || rsi > 70)) {
    ctx.watch([{ side: 'sell', price: price, trigger: 'above', note: 'FG Extreme Greed or RSI Overbought', conds: [
      { label: 'FG', now: fg, op: '>', ref: 75, closed: true },
      { label: 'RSI', now: rsi, op: '>', ref: 70, closed: false }
    ]}]);
    return { side: 'sell', qty: pos };
  }

  ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'Waiting for FG extreme fear signal' }]);
  return null;
}
