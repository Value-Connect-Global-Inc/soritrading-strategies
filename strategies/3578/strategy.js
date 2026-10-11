/*
 * @coinsori-strategy v1
 * name: BTC 1D On-Chain Usage Regime
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin price trends follow real network usage. When the
 *   number of active addresses runs above its 30-day average, the network is
 *   being used more — historically the setting in which price trends up. When
 *   usage rolls over, price tends to follow it down.
 * When it buys and sells: buy when active addresses are above their 30-day
 *   average AND price is above its 50-day average; sell when price closes below
 *   its 20-day average, when usage falls back below its 30-day average, or on a
 *   3x ATR stop.
 * When it does NOT work: on-chain usage lags price, so in fast crashes the
 *   strategy still takes the drawdown before usage rolls over. In quiet
 *   sideways markets with stable usage it can trade in and out repeatedly.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const ema20 = ctx.ema(20, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (addr == null || addrSma == null || ema20 == null || sma50 == null || atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 3 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };     // hard stop
    if (price < ema20) return { side: 'sell', qty: pos };       // trend broken
    if (addr < addrSma) return { side: 'sell', qty: pos };      // usage rolled over
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' },
               { side: 'sell', price: ema20, trigger: 'below', note: 'trend exit' }]);
    return null;
  }

  if (addr <= addrSma) return null;   // usage contracting — no longs
  if (price <= sma50) return null;    // still falling — don't catch the knife

  const riskCash = ctx.cash * 0.01;      // 1% equity risked per trade
  const stopDist = 3 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap position at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
