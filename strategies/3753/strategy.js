/*
 * @coinsori-strategy v1
 * name: ETH Dual-Side Trend 4H
 * ex: binanceusdm
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the dual-side trend family was validated on BTC (3722, all 3 windows
 * positive, captures the 2022 bear). This is a zero-tuning generalization test on ETH to see
 * whether the bear-capture edge is BTC-specific or general to large caps. Same logic: long
 * above a rising 200-SMA, short below a falling 200-SMA, flat in the middle.
 * When it buys and sells: go long when price closes above a rising 200-SMA; go short when
 * price closes below a falling 200-SMA. Entries need the 200-SMA to have moved >0.05% over
 * the prior 20 bars. Always a 2x ATR hard stop, sized to risk 1% of equity.
 * When it does NOT work: in a sideways market with a flat 200-SMA it stays flat; shorting a
 * violent bear rally (squeeze) hits the stop. Funding is charged on the futures position and
 * is not modeled here.
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
