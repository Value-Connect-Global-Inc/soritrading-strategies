/*
 * @coinsori-strategy v1
 * name: BTC RSI Mean-Reversion with Trailing Stop 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC on 4h often mean-reverts when RSI is deeply oversold —
 * sharp dips get bought back. We enter on extreme oversold and exit on a trailing stop
 * to let winners run while cutting losers.
 * When it buys and sells: buy when RSI(14) closes below 30 (oversold); sell when price
 * falls a fixed ATR multiple below the highest close since entry (trailing stop).
 * When it does NOT work: in a persistent downtrend RSI stays oversold and price keeps
 * falling, so the trailing stop takes small losses repeatedly — this loses in bear regimes.
 */
function onUpdate(ctx) {
  const rsi = ctx.rsi(14, 1);
  if (rsi == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  const price = ctx.price;

  // Entry: deeply oversold RSI on a closed bar
  if (ctx.position === 0) {
    if (rsi < 30) {
      const qty = ctx.cash / price * 0.98;
      ctx.watch([{ side:'buy', price: price, trigger:'below', note:'RSI oversold entry', conds:[{label:'RSI(14)', now:rsi, op:'<', ref:30, closed:true}] }]);
      return { side:'buy', qty: qty };
    }
    ctx.watch([{ side:'buy', price: price, trigger:'below', note:'RSI oversold entry', conds:[{label:'RSI(14)', now:rsi, op:'<', ref:30, closed:true}] }]);
    return null;
  }

  // Trailing stop: exit if price falls 3 ATR below the highest close since entry
  const highestSinceEntry = Math.max(...ctx.closes.slice(-50));
  const stop = highestSinceEntry - 3 * atr;
  ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'trailing stop 3 ATR' }]);
  if (price <= stop) {
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
