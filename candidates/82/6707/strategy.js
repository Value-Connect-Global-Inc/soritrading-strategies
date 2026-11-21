/*
 * @coinsori-strategy v1
 * name: ETH VIX-Regime Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: Crypto is a high-beta risk asset that tends to fall when market fear (measured by the CBOE VIX index) spikes, and rise when fear is low. This strategy uses VIX as a slow risk-on / risk-off gate: it only holds ETH while VIX is low (complacent, risk-on) and steps aside when VIX spikes (fear, risk-off).
 * When it buys and sells: Buys ETH when VIX is below its recent average (calm) and price is above its 200-bar average (uptrend); sells when VIX turns clearly high (fear) or when price falls a wide ATR-based distance below its peak since entry.
 * When it does NOT work: In a calm-but-sideways market (low VIX, no trend) ETH can chop and the trailing stop eventually stops out at a loss after fees. VIX is published with ~2 days lag, so a sudden fear spike is only seen late.
 */
function onUpdate(ctx) {
  const vix = ctx.data("base_vix");
  if (vix == null) { ctx.watch([]); return null; }

  const hist = ctx.state.vixHist || [];
  hist.push(vix);
  if (hist.length > 400) hist.shift();
  ctx.state.vixHist = hist;
  if (hist.length < 100) { ctx.watch([]); return null; }

  // z-score of current VIX vs its ~1.5-month mean (daily data repeats on 4h bars)
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
    // 5xATR trailing stop: wide enough to survive 4h noise, tight enough to lock gains
    const stop = hi * (1 - (5 * atr) / price);
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR trailing stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'fear exit',
        conds: [{ label: 'VIX high z>0.8', ok: z > 0.8 }] }
    ]);
    if (price <= stop || z > 0.8) {
      ctx.state.hi = null;
      ctx.state.cooldown = ctx.i + 24; // 4 days before re-entering after an exit
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.state.hi = null;
  if (ctx.state.cooldown && ctx.i < ctx.state.cooldown) { ctx.watch([]); return null; }
  ctx.watch([
    { side: 'buy', price: sma, trigger: 'above', note: 'trend up entry',
      conds: [{ label: 'VIX low z<-0.5', ok: z < -0.5 }] }
  ]);
  if (z < -0.5 && price > sma) {
    ctx.state.hi = price;
    ctx.state.cooldown = null;
    return { side: 'buy', qty: ctx.cash / price * 0.98 };
  }
  return null;
}
