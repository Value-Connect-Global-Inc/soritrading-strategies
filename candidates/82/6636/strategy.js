/*
 * @coinsori-strategy v1
 * name: ETH Trend VIX Filter 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: Ethereum's 4h trends are less reliable when equity-market
 * volatility (VIX) is elevated, because risk-off episodes whip crypto around.
 * Filtering those periods out and following a clean trend with an ATR stop
 * should cut drawdowns while keeping most of the upside.
 * When it buys and sells: buys when the 4h close crosses above the 100-EMA while
 * VIX is calm; sells when price falls below a 4x-ATR trailing stop or the close
 * drops back under the 100-EMA. Stays in cash while VIX is high.
 * When it does NOT work: in a sustained low-volatility bull market it misses part
 * of the rise that buy-and-hold gets in full; if VIX stays high for months it sits
 * out long stretches and underperforms.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const ema100_1 = ctx.ema(100, 1);
  const ema100_2 = ctx.ema(100, 2);
  const atr = ctx.atr(14, 1);
  if (ema100_1 == null || ema100_2 == null || atr == null || price == null) return null;

  const close1 = ctx.closes.at(-2);
  const close2 = ctx.closes.at(-3);
  if (close1 == null || close2 == null) return null;

  // VIX risk filter: stand aside when equity volatility is elevated (risk-off).
  const vix = ctx.data('base.vix');
  const vixCalm = vix == null ? true : vix < 28; // 28 = historically elevated VIX

  const state = ctx.state;

  if (ctx.position > 0) {
    const hi = Math.max(state.hi != null ? state.hi : close1, ctx.highs.at(-2) ?? close1);
    const stop = hi - 4 * atr; // 4x ATR: wide enough to survive normal 4h pullbacks in a bull
    state.hi = hi;
    const trendFlip = close1 < ema100_1;
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR trailing stop' },
      { side: 'sell', price: ema100_1, trigger: 'below', note: 'trend flip' }
    ]);
    if (price <= stop || trendFlip) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (!vixCalm) {
    ctx.watch([]);
    return null;
  }

  // Entry: 4h close crossed above the 100-EMA (faster than 200-EMA, enters earlier in a trend).
  if (close1 > ema100_1 && close2 <= ema100_2) {
    state.hi = close1;
    const watch = [{ side: 'buy', price: ema100_1, trigger: 'above', note: 'EMA100 cross, VIX calm' }];
    if (vix != null) watch[0].conds = [{ label: 'VIX', now: vix, op: '<', ref: 28, closed: true }];
    ctx.watch(watch);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }

  ctx.watch([]);
  return null;
}
