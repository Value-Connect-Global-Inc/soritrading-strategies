/*
 * @coinsori-strategy v1
 * name: ETH Pure USD-Regime 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: Crypto is priced in dollars and historically falls when the US dollar strengthens (risk-off) and rises when the dollar is weak. The dollar regime is used as the signal itself: long ETH while the dollar is weak, flat while the dollar is strong.
 * When it buys and sells: Buys ETH when the Fed broad dollar index drops to 0.5 std-dev below its recent average (weak dollar); sells when the dollar rises to 0.5 std-dev above its average (strong dollar), or if ETH falls 25% below entry (safety stop).
 * When it does NOT work: If crypto decouples from the dollar and falls while the dollar stays weak, the 25% stop is the only protection. The dollar index is published with about a 10-day lag, so a sudden dollar spike is only seen late.
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
  const pos = ctx.position || 0;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry * 0.75; // catastrophe stop: 25% below entry, only if crypto decouples from a weak dollar
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'catastrophe stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'risk-off exit',
        conds: [{ label: 'USD strong z>0.5', ok: z > 0.5 }] }
    ]);
    if (z > 0.5 || price <= stop) {
      ctx.state.cooldown = ctx.i + 24;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.state.cooldown && ctx.i < ctx.state.cooldown) { ctx.watch([]); return null; }
  ctx.watch([
    { side: 'buy', price: price, trigger: 'below', note: 'buy when USD weak',
      conds: [{ label: 'USD weak z<-0.5', ok: z < -0.5 }] }
  ]);
  if (z < -0.5) {
    ctx.state.cooldown = null;
    return { side: 'buy', qty: ctx.cash / price * 0.98 };
  }
  return null;
}
