/*
 * @coinsori-strategy v1
 * name: ETH Trend Regime Filter 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: a long trend regime filter. In crypto most of the return
 * comes in sustained up-trends and most of the damage in sustained down-trends,
 * so staying invested while the medium-term trend is up and stepping aside to
 * cash when it turns down should capture most of the upside while cutting the
 * deep drawdowns.
 * When it buys and sells: it buys when the 4h close is above a rising
 * medium-term moving average, and sells only when the close falls below a
 * falling average — both directions need the trend to confirm, so shallow
 * pullbacks inside a bull do not kick us out.
 * When it does NOT work: in a long sideways/chop market the average stays flat
 * and neither trend confirms, so we can be stuck holding through the chop and
 * pay whipsaw fees. It also gives back part of a strong rally start because it
 * waits for the trend to confirm.
 */

function onUpdate(ctx) {
  const N = 150;            // regime lookback: ~25 days on 4h — responsive enough to stay in a strong bull, still filters noise
  const buffer = 0.015;     // 1.5% dead-zone around the average so small wiggles do not flip the regime
  const RISE_BARS = 30;     // how many bars back we compare the average to decide if it is rising/falling (~5 days)

  const trend = ctx.sma(N, 1);
  const trendPrior = ctx.sma(N, 1 + RISE_BARS);
  const prevClose = ctx.closes.at(-2);
  if (trend == null || trendPrior == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }

  const trendRising = trend > trendPrior;
  const up = prevClose > trend * (1 + buffer) && trendRising;
  const down = prevClose < trend * (1 - buffer) && !trendRising;

  const holding = ctx.position > 0;

  ctx.watch([
    { side: 'buy',  price: trend * (1 + buffer), trigger: 'above', note: 'trend up', conds: [{ label: 'SMA rising', ok: trendRising }] },
    { side: 'sell', price: trend * (1 - buffer), trigger: 'below', note: 'trend down', conds: [{ label: 'SMA falling', ok: !trendRising }] }
  ]);

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (up && !holding) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.98 };
  }

  if (down && holding) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }

  return null;
}
