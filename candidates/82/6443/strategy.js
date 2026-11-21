/*
 * @coinsori-strategy v1
 * name: BTC Trend Regime SMA200 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: BTC's biggest profits come from a few long trends (2020-21 bull, 2023-24
 * recovery). A slow long-term trend filter holds those trends start to finish and
 * steps aside in the bears (2022, 2025) — capturing most of the upside with a
 * far smaller drawdown than buy-and-hold.
 * When it buys: the last closed bar is clearly above the 200-SMA (2%) and the
 * SMA200 itself is rising — the long-term trend is confirmed up.
 * When it sells: the close falls back below the SMA200 (long trend broke), or a
 * wide 5xATR trailing stop once the trade is up more than 8%.
 * When it does NOT work: a long flat sideways market — the 200-SMA whipsaws a
 * few times and the strategy pays fees without a trend to ride.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21); // 20 bars earlier, for the slope
  if (sma200 == null || sma200Prev == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;
  const price = ctx.price;
  const buyBand = sma200 * 1.02;   // enter only when clearly above the trend average
  const sellBand = sma200 * 0.98;  // base exit: clearly below the trend average

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    const entry = ctx.entryPx;
    let peak = ctx.state.peak || 0;
    if (prevClose > peak) peak = prevClose;
    ctx.state.peak = peak;

    let trail = null;
    // arm only after a clear profit so fresh-entry pullbacks never stop us out;
    // 5xATR is wide enough to survive normal bull-run pullbacks (judgement)
    if (atr != null && entry != null && peak > entry * 1.08) {
      trail = peak - 5 * atr;   // 5 ATR below the highest close since entry
    }
    const stop = (trail != null && trail > sellBand) ? trail : sellBand;

    ctx.watch([
      { side: 'sell', price: sellBand, trigger: 'below', note: 'trend breakdown' },
      { side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' }
    ]);
    if (prevClose < sellBand) {
      ctx.state.exitBar = ctx.i; // trend really broke — wait before re-entering
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (trail != null && prevClose < trail) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.state.peak = 0;
  const trendUp = sma200 > sma200Prev; // only buy when the trend average is rising
  // Cooldown after a trend-break exit: do NOT buy back into a broken downtrend on
  // the first bounce (dead-cat bounce) — these re-entries caused the deep 2022
  // drawdown. 60 bars = ~10 days of 4h bars, a typical bounce length (judgement).
  const cooldown = 60;
  const wait = ctx.state.exitBar != null && (ctx.i - ctx.state.exitBar) < cooldown;
  ctx.watch([{ side: 'buy', price: buyBand, trigger: 'above', note: 'uptrend confirmed',
    conds: [{ label: 'cooldown done', ok: !wait }] }]);
  if (prevClose > buyBand && trendUp && !wait) {
    ctx.state.exitBar = null;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
