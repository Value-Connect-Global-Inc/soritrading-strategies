/*
 * @coinsori-strategy v1
 * name: ETH VIX-Regime Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto is a global risk asset: when equity-market fear (the VIX index) is low, money flows into risky assets including ETH; when fear spikes, everything sells off together. This strategy uses the VIX as a slow "risk on / risk off" filter and only holds ETH while fear is low and the trend is up.
 * When it buys and sells: Buys ETH when the VIX is low relative to its recent average AND price is above its 200-bar average; sells when the VIX turns clearly fearful, or when price falls an ATR-based distance below its peak since entry. The stop is wider in calm regimes so normal 4h pullbacks do not sell it out of a continuing uptrend.
 * When it does NOT work: In a long calm sideways grind ETH can chop and the stop eventually exits at a loss after fees. The VIX is published with about a 2-day lag, so a sudden fear spike is only seen late. Crypto can also rally while equity fear is high (decoupling), which this strategy misses entirely.
 */
function onUpdate(ctx) {
  const vix = ctx.data("base_vix");
  if (vix == null) { ctx.watch([]); return null; }

  // Rolling VIX history (the daily value repeats on every 4h bar). ~250 days of daily data.
  const hist = ctx.state.vixHist || [];
  hist.push(vix);
  if (hist.length > 1500) hist.shift();
  ctx.state.vixHist = hist;
  if (hist.length < 1000) { ctx.watch([]); return null; }

  // z-score of current VIX vs its own recent mean (adaptive: works in calm and fearful eras alike)
  let mean = 0;
  for (let i = 0; i < hist.length; i++) mean += hist[i];
  mean /= hist.length;
  let v = 0;
  for (let i = 0; i < hist.length; i++) v += (hist[i] - mean) * (hist[i] - mean);
  v /= hist.length;
  const sd = Math.sqrt(v);
  if (sd < 1e-9) { ctx.watch([]); return null; }
  const z = (vix - mean) / sd;

  const price = ctx.price;
  const sma = ctx.sma(200);
  const atr = ctx.atr(14);
  if (sma == null || atr == null) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;

  if (pos > 0) {
    const hi = Math.max(ctx.state.hi || price, price);
    ctx.state.hi = hi;
    // Wider stop in a calm regime (10xATR) so bull-run pullbacks are not stopped out; tighter (5xATR) otherwise.
    const mult = z < -0.5 ? 10 : 5;
    const stop = hi * (1 - (mult * atr) / price);
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'fear exit',
        conds: [{ label: 'VIX high z>0.5', ok: z > 0.5 }] }
    ]);
    if (price <= stop || z > 0.5) {
      ctx.state.hi = null;
      ctx.state.cooldown = ctx.i + 8; // avoid instant re-entry after a stop-out
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.state.hi = null;
  if (ctx.state.cooldown && ctx.i < ctx.state.cooldown) { ctx.watch([]); return null; }
  ctx.watch([
    { side: 'buy', price: sma, trigger: 'above', note: 'trend up entry',
      conds: [{ label: 'VIX calm z<-0.5', ok: z < -0.5 }] }
  ]);
  if (z < -0.5 && price > sma) {
    ctx.state.hi = price;
    ctx.state.cooldown = null;
    return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  }
  return null;
}
