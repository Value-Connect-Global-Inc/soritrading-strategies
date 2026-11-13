/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin sentiment swings to extremes — panic (deep fear) and mania (extreme
 * greed). Buying the panic while the long-term uptrend is intact and selling into euphoria captures
 * the bull market at better prices than simply holding.
 * When it buys and sells: Buys most of cash when the Fear & Greed index is below 30 (fear) and the
 * daily close is above its ~200-day average. Sells when the index rises above 70 (greed), when the
 * close falls under the 200-day average, or price drops 25% from entry.
 * When it does NOT work: In a long quiet bull without panic dips it is often flat while holding
 * keeps compounding; in a fast crash that starts from greed it can still take a large stop loss;
 * and the index can stay in fear for months during a real bear, so the trend filter is what keeps
 * it out of falling knives.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 210) { ctx.watch([]); return null; }
  const price = ctx.price;
  const pos = ctx.position || 0;

  // account demoted/returning: no new entries, close any open position in an orderly way
  if (ctx.alloc != null && ctx.alloc.status != null && ctx.alloc.status !== 'ok') {
    if (pos > 0) {
      ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'Close: account not ok' }]);
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    ctx.watch([]);
    return null;
  }

  const fg = ctx.data('fear_greed'); // 0..100 crypto sentiment index, daily
  if (fg == null) { ctx.watch([]); return null; }
  const sma200 = ctx.sma(200, 1); // ~200-day trend gate: only buy fear inside a confirmed uptrend
  if (sma200 == null) { ctx.watch([]); return null; }
  const closePrev = closes.at(-2); // last CLOSED bar, identical in backtest/live
  if (closePrev == null) { ctx.watch([]); return null; }

  const trendUp = closePrev > sma200;
  const entryPx = ctx.entryPx;
  const stopHit = entryPx != null && price < entryPx * 0.75; // hard -25% stop on every position

  if (pos <= 0) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Long: fear + uptrend' }]);
    if (trendUp && fg < 30) { // buy only panic dips inside an uptrend, never a falling knife
      return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
    }
    return null;
  }

  ctx.watch([
    { side: 'sell', price: sma200, trigger: 'below', note: 'Exit: trend broke', conds: [{ label: 'Fear&Greed', now: fg, op: '>', ref: 70 }] },
    { side: 'sell', price: entryPx != null ? entryPx * 0.75 : price, trigger: 'below', note: 'Hard -25% stop' }
  ]);
  if (!trendUp || fg > 70 || stopHit) { // sell on euphoria, trend break or stop
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }
  return null;
}
