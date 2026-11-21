/*
 * @coinsori-strategy v1
 * name: BTC 4h Buy-the-Dip Mean Reversion
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In an uptrend, sharp oversold dips are usually a crowd overreaction and
 * price mean-reverts back up. We buy those dips and take a fixed profit instead of trying to
 * ride the whole trend, which keeps drawdowns small.
 * When it buys: RSI(14) drops below 30 (oversold, on a closed bar) while price is above its
 * 200-bar average (long-term uptrend intact). Buys with most of the cash.
 * When it sells: price rises 8% above the entry (profit taken) or closes below the 200-bar
 * average (the uptrend broke — cut the trade).
 * When it does NOT work: in a strong straight-line bull where RSI rarely drops below 30 the
 * strategy sits in cash and misses most of the rally; in a bear market it stays out entirely.
 */

function onUpdate(ctx) {
  const rsi = ctx.rsi(14, 1);
  const sma = ctx.sma(200, 1);
  if (rsi == null || sma == null) return null;

  const price = ctx.price;
  const inPos = ctx.position > 0;

  if (inPos) {
    // exit: fixed take-profit or the uptrend broke (this is also the trade's stop)
    const entry = ctx.entryPx;
    const tp = entry != null ? entry * 1.08 : null; // 8% profit target: typical 4h oversold bounce size
    ctx.watch([
      { side:'sell', price: tp != null ? tp : price, trigger:'above', note:'take profit +8%' },
      { side:'sell', price: sma, trigger:'below', note:'trend broke' }
    ]);
    if (tp != null && price >= tp) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (price < sma) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // entry: oversold dip that is still inside a long-term uptrend
  const oversold = rsi < 30;              // RSI below 30 = sharp 2-3 day drop, crowd overreaction
  const uptrend = price >= sma;
  ctx.watch([
    { side:'buy', price: sma, trigger:'above', note:'uptrend intact', conds:[{label:'RSI(14) close', now: rsi, op:'<', ref:30, closed:true}] }
  ]);
  if (oversold && uptrend) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
