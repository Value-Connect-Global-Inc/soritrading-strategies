/*
 * @coinsori-strategy v1
 * name: BTC Vol-Targeted Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends for long stretches, and its volatility
 * clusters — calm periods alternate with violent moves. This strategy rides
 * the trend (hold long while price is above its 33-day average) but sizes new
 * positions SMALLER when volatility is unusually high and takes no position
 * at all when volatility explodes to an extreme. The bet is that cutting size
 * during vol spikes keeps the drawdown small while the trend still captures
 * most of the upside.
 * When it buys and sells: Buys BTC when price closes above the 200-bar
 * (33-day) average and volatility is not extreme. Position size shrinks as
 * current volatility rises above its 100-bar baseline, but never below half
 * size. Sells to cash when price closes back below the 200-bar average, or
 * immediately when volatility explodes (current ATR more than 3.3x baseline).
 * When it does NOT work: in a long sideways range it flips on and off and
 * pays fees; and it lags the very top of a bull market (the 200-bar average
 * is slow), giving back part of the final rally before exiting.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  if (price == null || price <= 0) { ctx.watch([]); return null; }

  // 33-day trend line and volatility, all from CLOSED bars (no look-ahead)
  const trend = ctx.sma(200, 1);
  const atrShort = ctx.atr(14, 1);   // current volatility (fast)
  const atrBase = ctx.atr(100, 1);   // baseline volatility (slow)
  if (trend == null || atrShort == null || atrBase == null || atrBase <= 0) { ctx.watch([]); return null; }

  const close = ctx.closes.at(-2);
  const above = close > trend;

  // vol targeting: <1 means current vol is above its own 100-bar baseline
  const volRatio = atrBase / atrShort;
  let exposure = 1.0;
  if (volRatio < 0.3) {
    exposure = 0;                        // extreme vol blowout (ATR > 3.3x baseline): stand aside entirely
  } else {
    exposure = Math.max(0.5, Math.min(1.0, volRatio)); // scale down, but never below half size
  }
  const blowout = volRatio < 0.3;

  ctx.watch([
    { side: 'buy', price: trend, trigger: 'above', note: 'trend up -> buy', conds: [
        { label: 'close > SMA200', now: close, op: '>', ref: trend, closed: true },
        { label: 'vol not extreme', ok: !blowout }
      ] },
    { side: 'sell', price: trend, trigger: 'below', note: 'trend down -> cash', conds: [
        { label: 'close < SMA200', now: close, op: '<', ref: trend, closed: true }
      ] },
    { side: 'sell', price: trend, trigger: 'below', note: 'extreme vol -> cash', conds: [
        { label: 'ATR > 3.3x baseline', ok: blowout }
      ] }
  ]);

  // demoted / not-ok allocation: close any position in an orderly way, no new entries
  if (ctx.alloc) {
    if (ctx.alloc.status === 'demoted' && pos !== 0) {
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    if (ctx.alloc.status !== 'ok') return null;
  }

  // exits: trend flipped down, or extreme volatility (risk rule, direction-agnostic)
  if (pos !== 0 && (!above || blowout)) {
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }

  // entry: flat, trend up, vol not extreme — size scaled by exposure
  if (pos === 0 && above && exposure > 0) {
    const qty = (ctx.cash * 0.95 * exposure) / price;
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
