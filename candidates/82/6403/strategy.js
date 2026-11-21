/*
 * @coinsori-strategy v1
 * name: BTC 1D Regime-Gated Dip Buyer
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In a confirmed long-term uptrend, sharp fear-driven dips tend to revert and recover.
 * We buy those dips and then ride the recovery until the trend itself breaks, with a trailing stop that
 * locks in gains. We sit in cash during bear markets. Trading rarely with a bounded position and a hard
 * stop is what protects the account — earlier trend strategies traded hundreds of times and died by a
 * thousand cuts.
 * When it buys and sells: buys when the daily close is above the 200-day average (bull regime) and RSI is
 * oversold (below 38); sells when the close falls below the 100-day average (trend broke), or when price
 * falls 20% below the highest point since entry (trailing stop, never worse than -12% from entry).
 * When it does NOT work: in a long sideways market where every dip keeps falling, bought dips can hit the
 * stop. It underperforms a straight-line bull run where RSI never gets oversold. It is long-only, so it
 * misses short-selling the 2018/2022 bears — it just avoids them by staying in cash.
 */
function onUpdate(ctx) {
  if (!ctx.state) ctx.state = {};
  const close1 = ctx.closes.at(-2);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma100 = ctx.sma(100, 1);
  if (close1 == null || rsi == null || sma200 == null || sma100 == null) return null;

  const price = ctx.price;
  const inBull = close1 > sma200;   // regime gate: only buy inside a long-term uptrend

  // --- EXIT (while holding) ---
  if (ctx.position > 0) {
    const entry = ctx.entryPx;
    const peak = Math.max(ctx.state.peak || (entry != null ? entry : price), price);
    ctx.state.peak = peak;   // ratchet the trailing peak as price rises
    // stop = 20% under the peak, but never worse than -12% from entry (caps the loss on a fresh dip)
    const trailStop = Math.max(entry != null ? entry * 0.88 : price * 0.88, peak * 0.80);
    const trendBreak = close1 < sma100;   // the 100-day broke -> the uptrend is over
    ctx.watch([
      { side: 'sell', price: trailStop, trigger: 'below', note: 'trailing stop' },
      { side: 'sell', price: sma100, trigger: 'below', note: 'trend break' }
    ]);
    if (trendBreak) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (price < trailStop) {
      ctx.state.lastStopBar = ctx.i;   // remember the stop so we wait before re-entering
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  // --- ENTRY (flat) ---
  const lastStop = ctx.state.lastStopBar || 0;
  const cooldown = (ctx.i - lastStop) >= 10;   // 10-day pause after a stop-out to avoid re-entry whipsaw
  const dip = rsi < 38;                        // short-term oversold inside the uptrend
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'dip in bull regime', conds: [
    { label: 'RSI(14) close', now: rsi, op: '<', ref: 38, closed: true },
    { label: 'close > SMA200', ok: inBull }
  ]}]);
  if (inBull && dip && cooldown) {
    ctx.state.peak = null;   // reset the trail for the new position
    const qty = (ctx.cash * 0.60) / price;   // 60% of cash per dip: a -12% worst stop costs ~7% of the account
    return { side: 'buy', qty };
  }
  return null;
}
