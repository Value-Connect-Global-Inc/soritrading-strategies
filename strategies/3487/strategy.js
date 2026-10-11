/*
 * @coinsori-strategy v1
 * name: BbMeanReversionRefinedStrategy
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Exploits short-term overextensions in price relative to Bollinger Bands during ranging regimes.
 * When it buys and sells: Buys when price touches the lower Bollinger Band and RSI is deeply oversold, sells when price reaches the middle band or RSI recovers.
 * When it does not work: Suffers during prolonged strong directional trends where price hugs the outer bands.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const bb = ctx.bb(20, 2, 0);
  const rsi = ctx.rsi(14, 0);
  const sma200 = ctx.sma(200, 0);

  if (!bb || rsi === null || sma200 === null) return null;

  const lower = bb.lower;
  const middle = bb.middle;
  const position = ctx.position;

  // Watch conditions for display
  ctx.watch([
    { side: 'buy', price: lower, trigger: 'below', note: 'BB Lower Touch', conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'Above SMA200', ok: price > sma200 }
    ]},
    { side: 'sell', price: middle, trigger: 'above', note: 'BB Middle TP' }
  ]);

  if (position <= 0) {
    // Buy when price drops below lower band, RSI is oversold, and price is above long-term trend
    if (price <= lower && rsi < 30 && price > sma200) {
      const qty = (ctx.cash / price) * 0.98;
      return { side: 'buy', qty: qty };
    }
  } else {
    // Sell when price reaches middle band or RSI recovers above 55
    if (price >= middle || rsi > 55) {
      return { side: 'sell', qty: position };
    }
  }

  return null;
}
