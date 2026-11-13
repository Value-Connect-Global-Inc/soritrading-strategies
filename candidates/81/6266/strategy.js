/*
 * @coinsori-strategy v1
 * name: BTC Volume-Confirmed Pullback 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: in an uptrend, sharp pullbacks on above-average volume are often
 * capitulation — the weak hands sell out and the trend resumes. We buy those dips and
 * then ride the trend with a trailing stop instead of capping the profit.
 * When it buys and sells: buy when price is above the long trend (200 EMA) but pulled back
 * below the 50 EMA with RSI oversold AND volume above average; sell at the stop-loss,
 * when price falls 6% from its best point since entry (trailing stop), or when the
 * 200-EMA trend is broken.
 * When it does NOT work: in a long sideways range the dip-buys keep failing with small
 * losses; a sudden trend reversal right after a buy hits the stop; a bear market is
 * skipped by the 200-EMA filter, which also means we never profit from the short side.
 */
function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  const ema50 = ctx.ema(50, 1);
  const rsi = ctx.rsi(14, 1);
  const avgVol = ctx.avgVol(30);
  const vol = ctx.vol;
  const price = ctx.price;
  if (ema200 == null || ema50 == null || rsi == null || avgVol == null || vol == null) return null;

  if (ctx.position > 0) {
    // Track the best price since entry so the trailing stop can ratchet up.
    let peak = ctx.state.peak;
    if (peak == null || (ctx.entryPx != null && peak < ctx.entryPx)) peak = ctx.entryPx;
    if (price > peak) peak = price;
    ctx.state.peak = peak;

    const stop = ctx.entryPx != null ? ctx.entryPx * 0.93 : null;
    const trail = peak * 0.94;
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'stop loss' },
      { side: 'sell', price: trail, trigger: 'below', note: 'trailing stop' },
      { side: 'sell', price: ema200, trigger: 'below', note: 'trend exit' }
    ]);
    if (stop != null && price <= stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (price <= trail) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (price < ema200) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  ctx.watch([{
    side: 'buy', price: ema50, trigger: 'below', note: 'pullback entry',
    conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true },
      { label: 'volume>avg', ok: vol > avgVol },
      { label: 'uptrend', ok: price > ema200 }
    ]
  }]);

  // Buy the dip: uptrend intact, price pulled back below 50 EMA, oversold, high volume.
  if (price > ema200 && price < ema50 && rsi < 35 && vol > avgVol) {
    return { side: 'buy', qty: ctx.cash / price * 0.98 };
  }
  return null;
}
