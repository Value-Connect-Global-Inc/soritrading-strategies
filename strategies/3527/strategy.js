/*
 * @coinsori-strategy v1
 * name: ETH Mean Reversion RSI BB 1h
 * ex: binance
 * syms: ETH/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: ETH often exhibits mean-reverting behavior within local ranges, bouncing back to the mean when overextended.
 * When it buys and sells: Buys when RSI drops below oversold thresholds near the lower Bollinger Band, sells when price reverts to the middle SMA band or RSI recovers.
 * When it does not work: Strong trending bull or bear markets where price rides the bands and deep drawdowns occur without mean reversion.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  if (!p) return null;

  // Wait for indicators with sufficient warm-up bars
  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const sma20 = ctx.sma(20, 1);

  if (rsi == null || bb == null || sma20 == null) return null;

  const pos = ctx.position;
  const cash = ctx.cash;

  // Entry condition: RSI is oversold (< 30) AND price closed near or below the lower Bollinger Band
  if (pos === 0 || pos == null) {
    if (rsi < 32 && ctx.closes.at(-2) <= bb.lower * 1.01) {
      const qty = (cash / p) * 0.95; // Use 95% of available cash
      if (qty > 0) {
        ctx.watch([
          { side: 'buy', price: p, trigger: 'below', note: 'RSI & Lower BB Mean Reversion', conds: [
            { label: 'RSI(14)', now: rsi, op: '<', ref: 32, closed: true },
            { label: 'Lower BB touch', ok: true }
          ]}
        ]);
        return { side: 'buy', qty: qty };
      }
    }
  } else {
    // Exit condition: Price reaches middle SMA or RSI becomes overbought (> 65)
    if (p >= sma20 || rsi > 65) {
      ctx.watch([
        { side: 'sell', price: p, trigger: 'above', note: 'SMA Mean or RSI Overbought Exit', conds: [
          { label: 'RSI(14)', now: rsi, op: '>', ref: 65, closed: true }
        ]}
      ]);
      return { side: 'sell', qty: pos };
    }
  }

  return null;
}
