/*
 * @coinsori-strategy v1
 * name: Fear & Greed Sentiment Contrarian BTC 4h
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Extreme fear often marks local market bottoms during overall medium-term uptrends, allowing high-probability contrarian entries.
 * When it buys and sells: Buys when Fear & Greed index shows extreme fear (< 30) while price is above the 200 SMA, and sells on extreme greed (> 75) or trend violation.
 * When it does not work: Prolonged bear markets where extreme fear persists as prices continue to drop sharply.
 */

function onUpdate(ctx) {
  const fg = ctx.data('fg');
  const sma200 = ctx.sma(200, 1);
  const price = ctx.price;
  const pos = ctx.position;

  if (fg == null || sma200 == null || price == null) return null;

  // Watch conditions for live/paper view
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'Trend filter (Price > SMA200)', conds: [{ label: 'FG Index', now: fg, op: '<', ref: 30, closed: true }] },
    { side: 'sell', price: price, trigger: 'above', note: 'Take profit on Extreme Greed (> 75)' }
  ]);

  // Buy condition: extreme fear (< 30) and price above 200 SMA
  if (pos <= 0 && fg < 30 && price > sma200) {
    const qty = (ctx.cash / price) * 0.99;
    if (qty > 0) return { side: 'buy', qty };
  }

  // Sell condition: extreme greed (> 75) or trend break
  if (pos > 0 && (fg > 75 || price < sma200)) {
    return { side: 'sell', qty: pos };
  }

  return null;
}
