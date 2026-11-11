/*
 * @coinsori-strategy v1
 * name: ETH Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Ethereum trends hard at the 4h scale. A slow 200-bar average keeps us on the
 * long side of the trend and a chandelier stop (5-8xATR below the best high since entry) rides the
 * move. The risk budget and the stop WIDEN with trend strength: when price sits far above its own
 * 200-bar average (a strong melt-up) we hold a bigger position and let it run through corrections;
 * when the trend is weak we tighten both. This fixes the classic long-only trend failure of being
 * whipsawed out of straight-line melt-ups.
 * When it buys and sells: it buys when the 4h close is 3% above the 200-bar average. Position =
 * 25-45% of equity risked over a 5-8xATR stop, capped at full cash (more risk + wider stop when the
 * trend is strong). It sells when the close falls 3% below the 200-bar average or price drops
 * 5-8xATR below the best high since entry.
 * When it does NOT work: in sideways chop inside the band it stays flat and misses short swings; it
 * lags fast reversals because the 200-bar average is slow; and in a straight-line melt-up it still
 * trails buy-and-hold because it is not always fully invested.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  // Trend strength: how far the last CLOSED price sits above the 200-bar average.
  // 0 = at/below the average (weak), 0.15 = 15% above (strong melt-up).
  // Strong trend -> wider chandelier (hold through corrections) + bigger risk budget (stay invested).
  const trendStr = Math.max(0, prevClose / sma200 - 1);
  const chandMult = 5 + 3 * Math.min(1, trendStr / 0.15);        // 5x..8x ATR
  const riskBudget = 0.25 + 0.20 * Math.min(1, trendStr / 0.15); // 25%..45% of equity risked

  if (pos > 0) {
    const atrNow = ctx.atr(14, 1);
    const hh = ctx.state.hh != null ? Math.max(ctx.state.hh, price) : price;
    ctx.state.hh = hh;
    const chand = atrNow != null ? hh - chandMult * atrNow : price * 0.9;
    const exitPx = Math.max(sma200 * 0.97, chand);
    ctx.watch([{ side: 'sell', price: exitPx, trigger: 'below', note: 'Trend/chandelier exit' }]);
    if (prevClose <= exitPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.closes.length < 220) { ctx.watch([]); return null; }
  const entryPx = sma200 * 1.03;
  if (prevClose > entryPx) {
    ctx.state.hh = price;
    const atrNow = ctx.atr(14, 1);
    let qty = ctx.cash / price * 0.99;
    if (atrNow != null && atrNow > 0) {
      qty = Math.min(qty, (ctx.cash * riskBudget) / (chandMult * atrNow));
    }
    ctx.watch([{ side: 'buy', price: entryPx, trigger: 'above', note: 'ETH trend entry' }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: entryPx, trigger: 'above', note: 'ETH trend entry' }]);
  return null;
}
