/*
 * @coinsori-strategy v1
 * name: BtcBollingerRsiRefined
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Exploits oversold bounces in Bitcoin when the broader trend (SMA200) is up, using Bollinger Bands for entry and ATR for risk management.
 * When it buys and sells: Buys when price dips below the lower Bollinger Band, RSI is oversold, and price is above the 200 SMA. Sells on target profit, stop loss, or trend reversal.
 * When it does NOT work: Suffers in prolonged bear markets or sharp volatility expansions that breach stop-losses before rebounding.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const sma200 = ctx.sma(200);
  const bb = ctx.bb(20, 2);
  const rsi = ctx.rsi(14);
  const atr = ctx.atr(14);

  if (sma200 == null || bb == null || rsi == null || atr == null) return null;

  const pos = ctx.position;

  // Exit logic
  if (pos > 0) {
    const entryPx = ctx.entryPx;
    // Take profit or Stop loss using ATR
    if (p >= entryPx + 3.0 * atr || p <= entryPx - 1.5 * atr || p < sma200) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([
      { side: 'sell', price: entryPx + 3.0 * atr, trigger: 'above', note: 'Take Profit' },
      { side: 'sell', price: entryPx - 1.5 * atr, trigger: 'below', note: 'Stop Loss' }
    ]);
    return null;
  }

  // Entry logic: buy when below lower BB, RSI oversold, and above SMA200
  if (p > sma200 && p <= bb.lower && rsi < 35) {
    const qty = (ctx.cash / p) * 0.99;
    if (qty > 0) {
      ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB Lower Bounce' }]);
      return { side: 'buy', qty: qty };
    }
  }

  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'Waiting for lower BB' }]);
  return null;
}
