/*
 * @coinsori-strategy v1
 * name: BTC Trend Pullback 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a rising market, price does not climb in a straight
 * line — it makes higher highs then pulls back to its short-term average
 * before continuing. Buying the dip inside a rising long-term trend gets a
 * better entry than chasing a new high, and the rising 200-SMA keeps it out of
 * falling markets where "dips" are actually breakdowns.
 * When it buys and sells: buy when the 200-SMA is rising, price is above it,
 * and the last closed bar crossed back above the 20-SMA after being below it
 * (a completed pullback). Sell when a closed bar falls below the 50-SMA, or a
 * 12% hard stop is hit.
 * When it does NOT work: in a choppy range the 20/50-SMA whipsaw generates
 * repeated small losses; in a fast crash the 12% stop is wide and the exit
 * lags. It also misses the first leg of a bull because it waits for a pullback
 * that may not come.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 220) return null;
  const prevClose = c.at(-2);   // last closed bar

  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);   // 200-SMA 20 bars earlier -> slope
  const sma20 = ctx.sma(20, 1);
  const sma20Prev = ctx.sma(20, 2);      // 20-SMA one bar earlier
  const sma50 = ctx.sma(50, 1);

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.88;   // hard stop 12% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (sma50 != null && prevClose < sma50) return { side: 'sell', qty: pos };   // trend broke
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '12% stop' },
               { side: 'sell', price: sma50, trigger: 'below', note: 'below 50-SMA' }]);
    return null;
  }

  if (sma200 == null || sma200Prev == null || sma20 == null || sma20Prev == null) return null;
  if (!(sma200 > sma200Prev)) return null;              // long trend must be rising
  if (!(prevClose > sma200)) return null;               // price above long average
  const wasBelow = sma20Prev != null && prevClose <= sma20Prev;   // was under short MA
  if (!wasBelow) return null;
  if (!(prevClose > sma20)) return null;                // crossed back above -> pullback done

  ctx.watch([{ side: 'buy', price: sma20, trigger: 'above', note: 'pullback to 20-SMA',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true },
                       { label: 'price > 200-SMA', ok: prevClose > sma200, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);   // target 1.5% ATR risk, cap size
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
