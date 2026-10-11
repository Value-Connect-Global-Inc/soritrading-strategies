/*
 * @coinsori-strategy v1
 * name: BB Mean Reversion RSI ATR
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Exploits overextended price moves beyond Bollinger Bands expecting mean reversion.
 * When it buys and sells: Buys when price dips below lower BB and RSI is oversold; sells at middle BB or ATR stop.
 * When it does not work: Strong trending bull or bear markets where price rides the bands continuously.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;

  // Need at least 20 bars for Bollinger Bands and RSI
  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const atr = ctx.atr(14, 1);
  const sma20 = ctx.sma(20, 1);

  if (rsi == null || bb == null || atr == null || sma20 == null) {
    return null;
  }

  // Manage existing position
  if (pos > 0) {
    const entryPx = ctx.entryPx;
    // Stop loss or take profit at middle BB
    if (price <= entryPx - 2 * atr || price >= bb.mid) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Entry condition: price below lower BB and RSI oversold (< 35)
  const prevClose = ctx.closes.at(-2);
  if (prevClose <= bb.lower && rsi < 35) {
    const qty = (ctx.cash / price) * 0.99;
    if (qty > 0) {
      ctx.watch([
        { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB Lower Entry', conds: [{ label: 'RSI(14)', now: rsi, op: '<', ref: 35, closed: true }] },
        { side: 'sell', price: bb.mid, trigger: 'above', note: 'Mid BB Target' }
      ]);
      return { side: 'buy', qty: qty };
    }
  }

  return null;
}
