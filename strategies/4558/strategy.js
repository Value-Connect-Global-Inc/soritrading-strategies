/*
 * @coinsori-strategy v1
 * name: Bollinger Squeeze Breakout (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Different entry mechanism from the donchian champion —
 * instead of buying a new 55-day high, it waits for volatility to COMPRESS
 * (Bollinger bandwidth near a 1-year low = consolidation) and then buys the
 * first close above the upper band (volatility expansion). Consolidation ->
 * expansion is a classic breakout setup that catches trends from the start
 * of the move rather than after it has run.
 * When it buys and sells: buys when bandwidth (upper-lower)/mid is below its
 * 1-year average AND close closes above the upper Bollinger band. Sells when
 * close falls back below the middle band or a 20% hard stop is hit.
 * When it does NOT work: in a long sideways market the squeeze fires repeatedly
 * and each breakout fails (whipsaw); in a slow grind up without a prior squeeze
 * it never enters and misses the whole move.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  const n = closes.length;
  if (n < 260) return null; // need BB + 1y bandwidth history

  const bb = ctx.bb(20, 2, 1);
  if (bb == null) return null;
  const prevClose = closes[n - 2];
  const upper = bb.upper, lower = bb.lower, mid = bb.mid;
  if (!Number.isFinite(upper) || !Number.isFinite(lower) || !Number.isFinite(mid) || mid <= 0) return null;

  // Bandwidth today and its 1-year average (252 bars). A squeeze = bandwidth well
  // below its own 1y average, i.e. volatility has compressed.
  let bwAvg = 0, bwCount = 0;
  for (let i = n - 2 - 252; i <= n - 3; i++) {
    const b = ctx.bb(20, 2, n - 1 - i);
    if (b == null || !Number.isFinite(b.upper) || !Number.isFinite(b.lower) || !Number.isFinite(b.mid) || b.mid <= 0) continue;
    const bw = (b.upper - b.lower) / b.mid;
    bwAvg += bw; bwCount++;
  }
  if (bwCount < 100) return null;
  bwAvg /= bwCount;
  const bwNow = (upper - lower) / mid;

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.80; // 20% hard stop
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < mid) return { side: 'sell', qty: pos }; // back inside the bands = expansion over
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '20% stop' },
               { side: 'sell', price: mid, trigger: 'below', note: 'exit: back below mid band',
                 conds: [{ label: 'close vs mid band', ok: prevClose >= mid, closed: true }] }]);
    return null;
  }

  const squeeze = bwNow < bwAvg; // bandwidth compressed vs its 1y average
  const breakout = prevClose > upper; // first close above upper band
  ctx.watch([{ side: 'buy', price: upper, trigger: 'above', note: 'enter: close > upper band',
               conds: [{ label: 'close vs upper band', ok: breakout, closed: true },
                       { label: 'vol squeeze', ok: squeeze, closed: true }] }]);
  if (!squeeze || !breakout) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
