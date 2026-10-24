/*
 * @coinsori-strategy v1
 * name: BTC Momentum Sign-Flip 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A slow momentum measure (return over the last 90 days) separates real
 * trends from noise. When it is positive the market is in an uptrend worth holding through
 * dips; when it flips negative the trend is over and we move to cash. No crossover, no
 * breakout — just one number that flips sign rarely, so trades are few and fees stay low.
 * When it buys and sells: We are fully invested while the 90-day return stays positive. We
 * sell when it turns negative. That is the entire rule.
 * When it does NOT work: In a long sideways range the sign flips often and each flip is a
 * small loss. It gives back the top of every cycle because it only reacts after the move
 * is already over. It cannot beat a straight buy-and-hold in a one-way bull.
 */
function onUpdate(ctx) {
  const state = ctx.state || (ctx.state = {});
  const n = 90;   // 90-day momentum: long enough to ignore weekly noise, short enough to react to regime change
  const now = ctx.closes.at(-2);
  const past = ctx.closes.at(-2 - n);
  if (now == null || past == null || past <= 0) return null;

  const mom = (now - past) / past;
  state.mom = mom;
  state.momHist = state.momHist || [];
  state.momHist.push(mom);
  if (state.momHist.length > 200) state.momHist.shift();

  if (ctx.position === 0) {
    if (mom <= 0) return null;
    ctx.watch([{ side: 'sell', price: ctx.price * 0.8, trigger: 'below', note: 'stop -20%' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }

  if (ctx.position > 0) {
    const entry = ctx.entryPx;
    const stop = entry != null ? entry * 0.8 : null;   // hard stop so one bad momentum sign doesn't sink the account
    const watch = [];
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'stop -20%' });
    ctx.watch(watch);
    if (stop != null && ctx.price <= stop) return { side: 'sell', qty: ctx.position };
    if (mom <= 0) return { side: 'sell', qty: ctx.position };
  }
  return null;
}
