/*
 * @coinsori-strategy v1
 * name: BTC 4h Sentiment-Gated Trend Ride
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A pure price trend filter stays long at the very bottom of a crash
 * because moving averages lag. The Fear&Greed sentiment index turns to extreme fear at
 * exactly those capitulation moments. Gating the trend ride with "not extreme fear" cuts
 * the worst crash damage while keeping the trend profits.
 * When it buys: EMA50 above EMA200 (uptrend) AND Fear&Greed above 25 (not extreme fear).
 * When it sells: EMA50 falls below EMA200 (trend broke) OR Fear&Greed falls below 25
 * (extreme fear = capitulation, step aside).
 * When it does NOT work: in a bear market that grinds down with moderate fear (25-45), the
 * sentiment gate never triggers and only the EMA cross saves you — same as a pure trend filter.
 */

function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null; // sentiment data missing — do not trade blind

  const price = ctx.price;
  const inPos = ctx.position > 0;
  const up = e50 > e200;
  const notExtremeFear = fg > 25; // 25 = top of the "extreme fear" band on the 0-100 scale

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend + no extreme fear', conds:[{label:'EMA50>EMA200', ok: up, closed:true},{label:'Fear&Greed', now: fg, op:'>', ref:25, closed:true}] },
    { side:'sell', price: e200, trigger:'below', note:'trend broke or fear<25', conds:[{label:'Fear&Greed', now: fg, op:'<', ref:25, closed:true}] }
  ]);

  if (up && notExtremeFear && !inPos) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  if ((!up || !notExtremeFear) && inPos) {
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
