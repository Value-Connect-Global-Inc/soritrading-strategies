/*
 * @coinsori-strategy v1
 * name: ETH USD-Regime Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: Crypto is priced in dollars and historically tends to fall when the US dollar strengthens (risk-off) and rise when the dollar is weak. This strategy uses the Fed's broad dollar index as a slow "risk on / risk off" filter: it only holds ETH while the dollar is weak, and steps aside entirely when the dollar turns strong.
 * When it buys and sells: Buys ETH when the dollar is below its recent average (weak dollar) and the price is above its 200-bar average; sells when the dollar turns clearly strong (risk-off), or when price falls a wide ATR-based distance below its peak since entry.
 * When it does NOT work: In a sideways market with a weak dollar, ETH can chop for months and the wide trailing stop eventually stops out at a loss after fees. The dollar index is published with about a 10-day lag, so a sudden dollar spike is only seen late.
 */
function onUpdate(ctx) {
  const usd = ctx.data("base_usd_broad");
  if (usd == null) { ctx.watch([]); return null; }

  const hist = ctx.state.usdHist || [];
  hist.push(usd);
  if (hist.length > 800) hist.shift();
  ctx.state.usdHist = hist;
  if (hist.length < 200) { ctx.watch([]); return null; }

  // z-score of current USD vs its ~4.5-month mean (daily data repeats on 4h bars)
  let mean = 0;
  for (let i = 0; i < hist.length; i++) mean += hist[i];
  mean /= hist.length;
  let v = 0;
  for (let i = 0; i < hist.length; i++) v += (hist[i] - mean) * (hist[i] - mean);
  v /= hist.length;
  const sd = Math.sqrt(v);
  if (sd < 1e-9) { ctx.watch([]); return null; }
  const z = (usd - mean) / sd;

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
      { side: 'sell', price: price, trigger: 'below', note: 'risk-off exit',
        conds: [{ label: 'USD strong z>0.5', ok: z > 0.5 }] }
    ]);
    if (price <= stop || z > 0.5) {
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
      conds: [{ label: 'USD weak z<-0.5', ok: z < -0.5 }] }
  ]);
  if (z < -0.5 && price > sma) {
    ctx.state.hi = price;
    ctx.state.cooldown = null;
    return { side: 'buy', qty: ctx.cash / price * 0.98 };
  }
  return null;
}
