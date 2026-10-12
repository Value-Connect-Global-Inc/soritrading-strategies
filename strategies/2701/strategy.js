/*
 * @coinsori-strategy v1
 * name: Trend-Ride Pullback ETH 4H
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH trends in sustained multi-month waves. This rides
 * confirmed uptrends only — entering on a genuine pullback below the 20-EMA
 * that reclaims it, while the 50-EMA is rising and price is above the 200-SMA —
 * and exits on a trend break. It is the bull-capturing complement to the
 * defensive band-bounce champion, which lags strong melt-ups.
 * When it buys and sells: buys when price dips at least 0.5 ATR below the
 * 20-EMA in a confirmed uptrend (50-EMA above 200-SMA, 20-EMA rising over 3
 * bars) then closes back above it; sells when price closes below the 50-EMA
 * or hits a 3-ATR stop; waits 40 bars before re-entry.
 * When it does NOT work: in choppy/sideways regimes the pullback entries
 * whipsaw and give back gains; a sharp reversal that breaks the 50-EMA
 * immediately still takes the stop. Trend-following, not a dip buyer.
 *
 * 2024-01-15: display-only watch declarations added; trading logic unchanged.
 */
function onUpdate(ctx) {
  const ema20 = ctx.ema(20, 1);
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema20 == null || ema50 == null || ema200 == null || atr == null) return null;

  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    // exit: trend broke (close below 50-EMA) or stop hit
    ctx.watch([
      { side: 'sell', price: ema50, trigger: 'below', note: '50-EMA break' },
      { side: 'sell', price: ctx.entryPx - atr * 3, trigger: 'below', note: '3-ATR stop' }
    ]);
    if (price < ema50 || price <= ctx.entryPx - atr * 3) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // longer cooldown to kill re-entry churn
  const lastExit = ctx.state.lastExit || 0;
  if (ctx.i - lastExit < 40) {
    ctx.watch([]);
    return null;
  }

  // only long in a confirmed uptrend: 50>200 and 20-EMA rising over 3 bars
  if (ema50 <= ema200) {
    ctx.watch([]);
    return null;
  }
  const ema20_2 = ctx.ema(20, 2);
  const ema20_3 = ctx.ema(20, 3);
  if (ema20_2 == null || ema20_3 == null) return null;
  if (!(ema20 > ema20_2 && ema20_2 > ema20_3)) {
    ctx.watch([]);
    return null;
  }

  // genuine pullback: prev bar closed >=0.5 ATR below 20-EMA, current reclaims
  const prevClose = ctx.closes[ctx.closes.length - 2];
  if (prevClose == null) return null;
  const dipped = prevClose <= ema20 - atr * 0.5;
  if (!dipped) {
    ctx.watch([
      { side: 'buy', price: ema20 - atr * 0.5, trigger: 'below', note: 'pullback dip', conds: [
        { label: '20-EMA rising', ok: ema20 > ema20_2 && ema20_2 > ema20_3 },
        { label: '50-EMA > 200-SMA', ok: ema50 > ema200 }
      ]}
    ]);
    return null;
  }
  if (price <= ema20) {
    ctx.watch([
      { side: 'buy', price: ema20, trigger: 'above', note: 'reclaim 20-EMA', conds: [
        { label: 'prev close ≤ 20-EMA−0.5ATR', now: prevClose, op: '<=', ref: ema20 - atr * 0.5, closed: true },
        { label: '20-EMA rising', ok: ema20 > ema20_2 && ema20_2 > ema20_3 },
        { label: '50-EMA > 200-SMA', ok: ema50 > ema200 }
      ]}
    ]);
    return null;
  }

  ctx.watch([]);
  return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
}
