/*
 * @coinsori-strategy v1
 * name: BTC VIX-Trend Chandelier 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC drawdowns usually coincide with fear spikes in US
 * volatility, so the VIX level is a cheap risk-on/risk-off filter. A chandelier
 * (ATR) trailing stop rides a strong trend further than a moving-average cross
 * while still capping losses, so it keeps more of a bull run and cuts bear drops.
 * When it buys and sells: buys when BTC is in a 4h uptrend (SMA100 above SMA200
 * and SMA200 rising) while VIX is calm (<25); sells when the trend breaks (SMA100
 * falls below SMA200), price closes 3xATR below its highest high since entry, or
 * VIX spikes above 35 (extreme fear only).
 * When it does NOT work: sideways chop whipsaws the SMA entry and the trailing
 * stop, and a sustained VIX elevation keeps it out of a genuine BTC uptrend.
 */
function onUpdate(ctx) {
  const smaFast = ctx.sma(100, 1);
  const smaSlow = ctx.sma(200, 1);
  const smaSlowPrev = ctx.sma(200, 25); // ~4 days back, measures SMA200 slope
  if (smaFast == null || smaSlow == null || smaSlowPrev == null) return null;

  const vix = ctx.data("base_vix");
  const vixVal = vix == null ? 20 : vix; // unknown VIX -> treat as calm
  const trendUp = smaSlow > smaSlowPrev;

  if (ctx.position <= 0) {
    ctx.state.entryHigh = 0; // reset trailing anchor for a fresh position
    ctx.watch([
      { side: 'buy', price: smaSlow, trigger: 'above', note: 'trend up (SMA200)', conds: [{ label: 'VIX', now: vixVal, op: '<', ref: 25 }] }
    ]);
    if (smaFast > smaSlow && trendUp && vixVal < 25) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    return null;
  }

  // chandelier trailing stop from the highest CLOSED high since entry
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const closedHigh = ctx.highs.at(-2);
  let hh = ctx.state.entryHigh || 0;
  if (closedHigh > hh) hh = closedHigh;
  ctx.state.entryHigh = hh;
  const stop = hh - 3 * atr; // 3xATR: wide enough for bull pullbacks, tight enough to cap bear drops

  const trendBreak = smaFast < smaSlow;
  const fearExit = vixVal > 35; // only extreme fear forces an exit

  ctx.watch([
    { side: 'sell', price: stop, trigger: 'below', note: 'trailing stop (3 ATR)' },
    { side: 'sell', price: smaFast, trigger: 'below', note: 'trend break (SMA100)', conds: [{ label: 'VIX', now: vixVal, op: '>', ref: 35 }] }
  ]);

  if (trendBreak || fearExit) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  const closedLow = ctx.lows.at(-2);
  if (closedLow <= stop) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
