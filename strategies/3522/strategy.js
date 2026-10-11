/*
 * @coinsori-strategy v1
 * name: Fear Greed Sentiment Contrarian BTC 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Exploits market overreactions by buying extreme fear and selling extreme greed when aligned with the medium-term trend.
 * When it buys and sells: Buys when Fear & Greed is below 30 and price is above the 200 EMA; sells when Greed is above 70 or stop-loss hits.
 * When it does not work: Fails during prolonged structural bear markets where fear deepens persistently or sideways choppy ranges.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  if (!price) return null;

  // Read Fear & Greed sentiment from dataset
  const fg = ctx.data('fear_greed');
  if (fg == null) return null;

  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  if (sma50 == null || sma200 == null) return null;

  const pos = ctx.position;

  // Watch conditions for display
  ctx.watch([
    { side: 'buy', price: price, trigger: 'below', note: 'Extreme Fear < 30', conds: [
      { label: 'FG value', now: fg, op: '<', ref: 30, closed: true },
      { label: 'Trend bullish', ok: price > sma200 }
    ]},
    { side: 'sell', price: price, trigger: 'above', note: 'Extreme Greed > 70', conds: [
      { label: 'FG value', now: fg, op: '>', ref: 70, closed: true }
    ]}
  ]);

  // Entry: Extreme Fear (<30) + Bullish Trend (Price > EMA200)
  if (pos === 0) {
    if (fg < 30 && price > sma200) {
      const qty = (ctx.cash / price) * 0.98;
      return { side: 'buy', qty: qty };
    }
  }

  // Exit: Extreme Greed (>70) or Stop Loss / Take Profit
  if (pos > 0) {
    if (fg > 70) {
      return { side: 'sell', qty: pos };
    }
  }

  return null;
}
