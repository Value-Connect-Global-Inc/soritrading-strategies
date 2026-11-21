/*
 * @coinsori-strategy v1
 * name: ETH OnChain Regime 4H
 * ex: binanceusdm
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin on-chain activity (daily unique active addresses) is a
 * proxy for real crypto usage. When network usage is growing relative to its 30-day
 * average, the market regime is healthy and trends persist. When usage collapses,
 * risk appetite is fading even if price has not fallen yet.
 * When it buys and sells: Goes long when ETH is in an uptrend (50 > 200 EMA) AND
 * on-chain activity is above its 30-day average; shorts when ETH is in a downtrend
 * AND activity is below its 30-day average. Steps aside (flat) when the trend and
 * the on-chain signal disagree. Exits on a trend flip, on an on-chain flip, or on a
 * 2.5xATR hard stop.
 * When it does NOT work: in a speculation-driven bull market where price rises while
 * on-chain usage stays flat (addresses lag price), and in choppy sideways markets
 * that whipsaw the EMA cross.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const atr = ctx.atr(14, 1);
  const fast = ctx.ema(50, 1);
  const slow = ctx.ema(200, 1);
  const addr = ctx.data("addr");
  const addrSma = ctx.data("addr_sma30");
  if (price == null || price <= 0 || atr == null || fast == null || slow == null) { ctx.watch([]); return null; }

  // on-chain health: active addresses vs their 30-day average (>1 = healthy, <1 = fading)
  const health = (addr != null && addrSma != null && addrSma > 0) ? addr / addrSma : null;
  const healthOk = health != null ? health > 1.0 : null;

  const trendUp = fast > slow;

  // restart-surviving close when entry price is unknown (run started holding)
  if (pos !== 0 && ctx.entryPx == null) {
    const side = pos > 0 ? 'sell' : 'buy';
    ctx.watch([{ side: side, price: price, trigger: pos > 0 ? 'below' : 'above', note: 'restart close' }]);
    return { side: side, qty: Math.abs(pos), reduceOnly: true };
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  // while holding: exits only
  if (pos !== 0) {
    const side = pos > 0 ? 'sell' : 'buy';
    const entry = ctx.entryPx != null ? ctx.entryPx : price;
    const stopPx = pos > 0 ? entry - 2.5 * atr : entry + 2.5 * atr; // hard stop at 2.5xATR
    const trendExit = pos > 0 ? !trendUp : trendUp;                 // trend flipped against us
    const healthExit = pos > 0 ? healthOk === false : healthOk === true; // on-chain flipped
    ctx.watch([
      { side: side, price: stopPx, trigger: pos > 0 ? 'below' : 'above', note: 'ATR stop' },
      { side: side, price: slow, trigger: pos > 0 ? 'below' : 'above', note: 'trend flip' }
    ]);
    if (trendExit || healthExit) {
      return { side: side, qty: Math.abs(pos), reduceOnly: true };
    }
    if (pos > 0 ? price <= stopPx : price >= stopPx) {
      return { side: side, qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }

  // flat: constant-risk sizing, risk a fixed fraction of equity on a 2.5xATR stop
  const RISK_BUDGET = 0.008; // 0.8% of equity at risk per trade
  const stopDist = 2.5 * atr;
  const qty = stopDist > 0 ? (ctx.cash * RISK_BUDGET) / stopDist : 0;
  if (qty <= 0) { ctx.watch([]); return null; }

  const long = trendUp && healthOk === true;
  const short = !trendUp && healthOk === false;
  ctx.watch([
    { side: 'buy', price: slow, trigger: 'above', note: 'EMA cross up + healthy on-chain', conds: [{ label: 'addr > 30d avg', ok: healthOk === true, closed: true }] },
    { side: 'sell', price: slow, trigger: 'below', note: 'EMA cross down + fading on-chain', conds: [{ label: 'addr < 30d avg', ok: healthOk === false, closed: true }] }
  ]);
  if (long) return { side: 'buy', qty: qty };
  if (short) return { side: 'sell', qty: qty };
  return null;
}
