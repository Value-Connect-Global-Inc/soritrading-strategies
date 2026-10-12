/*
 * @coinsori-strategy v1
 * name: UptrendPullbackRSI
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto trends hard, so buying dips is only safe inside an
 * established uptrend. This bets that pullbacks in a market above its 200-day
 * average (a bull regime) tend to bounce, while a hard stop and a trend-break
 * exit cap the damage when the regime is actually over.
 * When it buys and sells: buy when the close is above the 200-day average AND
 * RSI(14) closes below 32 (a deep oversold pullback inside an uptrend). Sell
 * when the close recovers above the 20-day average, or on a 2x ATR stop below
 * the entry, or when the close falls back below the 200-day average.
 * When it does NOT work: in a bear market price stays below the 200-day average
 * and the strategy never trades (safe but no profit); in a slow grinding bull
 * with no sharp pullbacks RSI rarely reaches 32 and few trades happen; in a
 * choppy range above the 200-day it can buy dips that keep falling and hit the
 * stop repeatedly.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  if (sma200 == null || rsi == null) return null;
  const pos = ctx.position;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    const sma20 = ctx.sma(20, 1);
    if (atr == null || sma20 == null) return null;
    const hardStop = ctx.entryPx - 2 * atr;
    // Exit on recovery (close back above 20d), regime failure (close below 200d),
    // or a hard 2x ATR stop. All three are independent of any entry condition.
    if (prevClose < sma20 || prevClose < sma200 || price <= hardStop) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma20, trigger: 'below', note: 'recovery exit' }]);
    return null;
  }

  // Buy only an oversold dip that happens inside an uptrend (close > 200d).
  // RSI<32 = deep pullback; in a real bull these bounce, in a fake-out they stop out.
  if (prevClose > sma200 && rsi < 32) {
    ctx.watch([]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', note: 'wait for oversold dip in uptrend',
               conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 32, closed: true },
                       { label: 'close>200d', ok: prevClose > sma200 }] }]);
  return null;
}
