/*
 * @coinsori-strategy v1
 * name: BTC 200-Day Trend Hysteresis 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: BTC trends for months at a time; a plain 200-SMA cross
 * whipsaws in chop. The band makes entries/exits decisive.
 * When it buys and sells: buys when price breaks >200-day SMA * 1.07 (clear
 * uptrend), sells when price drops < 200-day SMA * 0.93 (clear downtrend).
 * When it does NOT work: in long sideways ranges the band delays the exit and
 * eats the whole position; it also sits out the first 200 bars of history.
 * It is all-in on BTC so drawdowns are full market drawdowns.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) {
    ctx.watch([]);
    return null;
  }
  const holding = ctx.position > 0;
  if (!holding && price > sma200 * 1.07) {
    ctx.watch([{ side: 'buy', price: sma200 * 1.07, trigger: 'above', note: 'breakout above 200d' }]);
    return { side: 'buy', qty: ctx.cash / price * 0.99 };
  }
  if (holding && price < sma200 * 0.93) {
    ctx.watch([{ side: 'sell', price: sma200 * 0.93, trigger: 'below', note: 'exit below 200d' }]);
    return { side: 'sell', qty: ctx.position };
  }
  if (holding) {
    ctx.watch([{ side: 'sell', price: sma200 * 0.93, trigger: 'below', note: 'exit below 200d' }]);
  } else {
    ctx.watch([{ side: 'buy', price: sma200 * 1.07, trigger: 'above', note: 'breakout above 200d' }]);
  }
  return null;
}
