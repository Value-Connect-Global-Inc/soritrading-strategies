/*
 * @coinsori-strategy v1
 * name: ETH ATR-Sized VIX-Gated Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH trends hard in bull markets and crashes hard when fear spikes. This strategy rides the uptrend while price is above its 200-bar average, but only when equity fear (VIX) is calm, and it sizes every position so one big adverse move costs only ~8% of the account. In low volatility it holds big positions; in high volatility it holds small ones.
 * When it buys and sells: It buys when ETH closes above its 200-bar average while VIX is not spiking. It sells when ETH closes back below the average, when VIX spikes, or when price falls 5 average-ranges below its recent peak (wide trailing stop that avoids 4h noise). It never shorts.
 * When it does NOT work: In a sideways market ETH wanders across the 200-bar line and every crossing pays fees. In a crypto-only crash that equity markets never see (VIX stays calm), the VIX gate does not help and the trailing stop takes the loss. A sudden gap down exits late and eats part of the drop.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null) return null;
  const pos = ctx.position;
  const cash = ctx.cash || 0;

  // Closed-bar values so backtest, paper and live agree.
  const s200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const close1 = ctx.closes.at(-2);
  if (s200 == null || atr == null || close1 == null) { ctx.watch([]); return null; }

  // VIX z-score vs its own recent window (rolling buffer of 4h bars; VIX updates ~daily).
  const vix = ctx.data('base.vix');
  let vbuf = (ctx.state && ctx.state.vbuf) || [];
  if (vix != null) {
    vbuf.push(vix);
    if (vbuf.length > 420) vbuf = vbuf.slice(-420);
    if (ctx.state) ctx.state.vbuf = vbuf;
  }
  let vixZ = null;
  if (vbuf.length >= 120) {
    const win = vbuf.slice(-240);   // ~40 days of daily VIX observations
    const m = win.reduce((a, b) => a + b, 0) / win.length;
    const v = win.reduce((a, b) => a + (b - m) * (b - m), 0) / win.length;
    const sd = Math.sqrt(v);
    if (sd > 0) vixZ = (vix - m) / sd;
  }
  const vixCalm = vixZ != null ? vixZ < 1.0 : true;   // no VIX data -> do not block

  const trendUp = close1 > s200;

  // Highest close since entry, kept in ctx.state so it survives restarts.
  let peak = (ctx.state && ctx.state.peak) || 0;
  if (pos != null && pos > 0) {
    peak = Math.max(peak, close1);
    if (ctx.state) ctx.state.peak = peak;
  }

  if (pos != null && pos > 0) {
    const trail = peak - 5 * atr;   // wide 5xATR chandelier: avoids 4h whipsaw
    ctx.watch([
      { side: 'sell', price: s200, trigger: 'below', note: 'trend break exit', conds: vixZ != null ? [{ label: 'VIX z-score', now: vixZ, op: '>', ref: 1.2 }] : [] },
      { side: 'sell', price: trail, trigger: 'below', note: 'wide trailing stop' }
    ]);
    if (!trendUp || (vixZ != null && vixZ > 1.2)) {
      if (ctx.state) ctx.state.peak = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (price <= trail) {
      if (ctx.state) ctx.state.peak = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';
  const forceClosed = !!(ctx.alloc && ctx.alloc.lastForced);
  if (!allocOk || forceClosed) { ctx.watch([]); return null; }

  if (trendUp && vixCalm) {
    ctx.watch([{ side: 'buy', price: s200, trigger: 'above', note: 'trend up entry' }]);
    // ATR-risk sizing: a full 5xATR stop move costs ~8% of equity, capped at full cash.
    let qty = (cash * 0.08) / (5 * atr);
    if (qty * price > cash) qty = cash / price;
    qty *= 0.98;
    if (qty <= 0) return null;
    if (ctx.state) ctx.state.peak = close1;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
