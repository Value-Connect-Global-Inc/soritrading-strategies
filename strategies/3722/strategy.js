/*
 * @coinsori-strategy v1
 * name: BTC Dual-Side Trend 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: every strategy tested in this job is long-only, so bear markets are
 * either sat out (flat) or bled through. This is a genuinely different family: it trades
 * BOTH sides of a 200-day trend on perpetual futures. When BTC is below its 200-day average
 * and that average is falling, it goes short — capturing the down-leg that long-only systems
 * can only avoid.
 * When it buys and sells: go long when price closes above a rising 200-SMA; go short when
 * price closes below a falling 200-SMA. Flat in the middle (SMA flat or price crossing it
 * with no slope). Entries need a confirmed trend: the 200-SMA must have moved more than
 * 0.05% over the prior 20 bars, so a flat wiggling average cannot whipsaw the position.
 * Always a 2x ATR hard stop on the position, sized to risk 1% of equity.
 * When it does NOT work: in a sideways market where the 200-SMA slope wiggles around zero it
 * stays flat (safe but no profit); shorting a violent bear rally (squeeze) hits the stop.
 * Funding is charged on the futures position and is not modeled here — a long hold over many
 * days pays funding that this backtest ignores.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const sma200ago20 = ctx.sma(200, 21);   // 20 bars before the last closed bar = the trend's recent slope
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma200prev == null || sma200ago20 == null || atr == null || atr <= 0) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  // Confirmed trend: the 200-SMA must have moved >0.05% over the last 20 bars.
  // 0.05% per 20x4h bars is a slow-but-real drift; anything smaller is chop that whipsaws.
  const slopePct = (sma200 / sma200ago20 - 1) * 100;
  const trendUp = slopePct > 0.05;
  const trendDown = slopePct < -0.05;

  const pos = ctx.position;
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop || prevClose < sma200) { ctx.watch([]); return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'trend break' }]);
    return null;
  }
  if (pos < 0) {
    const hardStop = ctx.entryPx + 2 * atr;
    if (price >= hardStop || prevClose > sma200) { ctx.watch([]); return { side: 'buy', qty: -pos }; }
    ctx.watch([{ side: 'buy', price: hardStop, trigger: 'above', note: '2x ATR stop' },
               { side: 'buy', price: sma200, trigger: 'above', note: 'trend break' }]);
    return null;
  }

  // risk 1% of equity via 2x ATR stop
  const riskCash = 0.01 * ctx.cash;
  let qty = riskCash / (2 * atr);
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) { ctx.watch([]); return null; }

  if (trendUp && prevClose > sma200) { ctx.watch([]); return { side: 'buy', qty }; }
  if (trendDown && prevClose < sma200) { ctx.watch([]); return { side: 'sell', qty }; }
  ctx.watch([]);
  return null;
}
