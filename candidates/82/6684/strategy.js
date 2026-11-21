/*
 * @coinsori-strategy v1
 * name: FearGreed Recovery BTC 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Bet: the Crypto Fear & Greed Index mean-reverts — extreme fear marks short-term capitulation and
 * prices tend to recover once the panic starts lifting, but only inside a longer uptrend.
 * Buy when the index recovers out of extreme fear (crosses above 30) while SMA50 is above SMA200 and
 * price is above SMA50; sell when the index reaches greed (>=75) at new highs, the 4h trend breaks
 * (close below SMA50), or price falls 15% from the entry.
 * Fails when a real bear market starts (the trend filter eventually turns and the stop takes a loss)
 * or in choppy sideways markets that whipsaw the SMA50 exit.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const cash = ctx.cash;

  // trend regime on closed bars
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  if (sma50 == null || sma200 == null) { ctx.watch([]); return null; }

  // Fear & Greed (daily sentiment). Try the canonical name, then fallbacks.
  let fg = ctx.data('main.fear_greed');
  if (fg == null) fg = ctx.data('fear_greed');
  if (fg == null) fg = ctx.data('fear_greed_index');
  if (fg == null) { ctx.watch([]); return null; }

  // detect the recovery crossover: index was in fear (<=30) and now lifts above it
  const prevFg = ctx.state.prevFg;
  ctx.state.prevFg = fg;
  const recovering = prevFg != null && prevFg <= 30 && fg > 30;

  const prevClose = ctx.closes.at(-2);
  const dcHigh = ctx.high(20, 1); // highest high of the last 20 closed bars

  if (pos <= 0) {
    const buyWatch = [{
      side: 'buy', price: sma50, trigger: 'above', note: 'F&G recovery in uptrend',
      conds: [
        { label: 'F&G>30', now: fg, op: '>', ref: 30, closed: true },
        { label: 'SMA50>SMA200', ok: sma50 > sma200 }
      ]
    }];
    ctx.watch(buyWatch);
    // entry only after the panic has started lifting, and only inside an uptrend
    if (recovering && sma50 > sma200 && price > sma50) {
      return { side: 'buy', qty: (cash / price) * 0.99 };
    }
    return null;
  }

  // --- exit logic while holding ---
  const entryPx = ctx.entryPx;
  const hardStop = entryPx != null ? entryPx * 0.85 : null;

  const watch = [];
  if (hardStop != null) watch.push({ side: 'sell', price: hardStop, trigger: 'below', note: 'hard stop' });
  watch.push({ side: 'sell', price: sma50, trigger: 'below', note: 'trend break' });
  if (dcHigh != null) watch.push({ side: 'sell', price: dcHigh, trigger: 'above', note: 'greed at highs', conds: [{ label: 'F&G>=75', now: fg, op: '>=', ref: 75, closed: true }] });

  // greed at new highs: sentiment euphoric and price making 20-bar highs
  if (dcHigh != null && fg >= 75 && price >= dcHigh) {
    ctx.watch(watch);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  // trend break
  if (prevClose != null && prevClose < sma50) {
    ctx.watch(watch);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  // hard stop
  if (hardStop != null && price <= hardStop) {
    ctx.watch(watch);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  ctx.watch(watch);
  return null;
}
