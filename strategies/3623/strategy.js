/*
 * @coinsori-strategy v1
 * name: ETH On-Chain Network Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: buy ETH when on-chain network activity (active addresses)
 *   is above its 30-day average — a slow fundamental signal of real usage — and
 *   price is in an uptrend above the 100-EMA. Different family from the price
 *   breakout trend: this one trades on fundamentals.
 * When it buys and sells: buy when active addresses are above their 30-day
 *   average and the close is above the 100-EMA. Sell when the close falls below
 *   the 100-EMA, when active addresses drop below their 30-day average, or on a
 *   3x ATR hard stop.
 * When it does NOT work: in rallies not backed by growing network usage
 *   (speculative melt-ups), and it is slow because the on-chain signal updates
 *   only once per day.
 */
function onUpdate(ctx) {
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null || addr == null || addrSma == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 3 * atr;
    const trendBreak = prevClose < ema100;
    const networkBreak = addr < addrSma;   // network usage rolling over
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (trendBreak) return { side: 'sell', qty: ctx.position };
    if (networkBreak) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '3x ATR hard stop' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA trend break' },
               { side: 'sell', price: null, note: 'net addresses below 30d avg' }]);
    return null;
  }

  if (prevClose <= ema100) return null;      // only buy in an uptrend
  if (addr <= addrSma) return null;          // network must be expanding (above its 30-day average)

  // risk 2% of cash on a 3x ATR stop, capped by available cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 3 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
