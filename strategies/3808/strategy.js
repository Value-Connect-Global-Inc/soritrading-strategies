/*
 * @coinsori-strategy v1
 * name: DxyDataProbe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic probe. It only exists to answer two questions:
 * (1) does ctx.data('dxy') return real values in a backtest, and (2) does
 * persistent state (ctx.state) survive across ticks. No real trading logic.
 * When it buys and sells: buys exactly once when it has seen 60 bars with a
 * non-null dxy reading; never sells. If it trades, both mechanisms work.
 * When it does NOT work: not a real strategy — diagnostic only.
 */

function onUpdate(ctx) {
  const dxy = ctx.data('dxy');
  let seen = ctx.state.seen || 0;
  if (dxy != null) seen++;
  ctx.state.seen = seen;

  // report every 200 bars so we can see data health in the log tail
  if (ctx.i % 200 === 0) {
    ctx.log('i=' + ctx.i + ' dxy=' + dxy + ' seen=' + seen + ' pos=' + (ctx.position || 0));
  }

  if (ctx.position > 0) return null;
  if (seen >= 60) {
    return { side:'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
