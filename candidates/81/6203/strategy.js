/*
 * @coinsori-strategy v1
 * name: BTC 4H Funding Sentiment Gate Trend
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The funding rate is a direct reading of leveraged positioning — strongly
 * positive funding means crowded longs are paying shorts (squeeze risk), negative funding means
 * crowded shorts. We reuse the proven EMA50/200 trend core but gate it with a funding z-score:
 * never chase a move that is already owned by the crowd, and take profit when the crowd is
 * maximally long. This is a DIFFERENT information source than the macro gates (VIX, USD)
 * validated in earlier cycles — positioning instead of macro liquidity.
 * When it buys and sells: Buy when the 4h trend is up (EMA50 above EMA200, price above EMA50)
 * and funding is not unusually high (z-score vs its own ~6-week history < 1). Sell when the
 * trend breaks, funding spikes (z-score > 2), or price falls -25% from entry.
 * When it does NOT work: funding can stay elevated for months in a persistent bull market, so
 * the gate keeps us out of a melt-up that never cools; funding is a noisy mean-reverting series
 * that whipsaws in calm chop. It also cannot help a crash driven by on-chain or macro shocks
 * that leave funding flat.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }
  const fund = ctx.funding;
  if (fund == null) { ctx.watch([]); return null; }

  // Rolling funding history for the z-score (same shape as the validated VIX/USD gates).
  const hist = ctx.state.fundHist || [];
  if (hist.length === 0 || hist[hist.length - 1] !== fund) {
    hist.push(fund);
    if (hist.length > 250) hist.shift();
    ctx.state.fundHist = hist;
  }
  let fundZ = 0;
  if (hist.length >= 60) {
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length) || 1e-6;
    fundZ = (fund - mean) / sd;
  }

  const trendUp = ema50 > ema200 && prevClose > ema50;

  if (ctx.position > 0) {
    const exitBelow = Math.min(ema50, ema200);
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.75 : null;
    ctx.watch([
      { side: 'sell', price: exitBelow, trigger: 'below', note: 'trend broken' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'funding spike', conds: [{ label: 'fund z>2', ok: fundZ > 2 }] },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'disaster stop -25%' }] : [])
    ]);
    if (fundZ > 2) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < exitBelow) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc != null && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  if (trendUp && fundZ < 1) {
    ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'trend up, funding calm', conds: [{ label: 'fund z<1', ok: fundZ < 1 }] }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'waiting trend up', conds: [{ label: 'fund z<1', ok: fundZ < 1 }] }]);
  return null;
}
