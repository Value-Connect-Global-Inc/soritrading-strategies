/*
 * @coinsori-strategy v1
 * name: SqueezeBreakout
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: a Bollinger-style squeeze (volatility compressing to a
 * low) followed by a breakout above a recent high tends to produce a stronger
 * move than a random breakout, because the compressed energy releases in a
 * sustained direction. It is a different entry mechanism from the Donchian
 * champion (which buys every new high) — this waits for the squeeze first.
 * When it buys and sells: buy when a close is a new 20-day high AND short-term
 * volatility (ATR14/price) is below its own longer-term average (ATR60/price),
 * i.e. the market is coiled. Sell on a 10-day low or a 2x ATR stop below entry.
 * Each position is sized to risk 1% of equity, capped at 40% of equity.
 * When it does NOT work: in a normal trending market with no compression phase
 * it rarely trades (misses steady trends the Donchian system catches); in a
 * choppy market the 20-day-high entry whipsaws like any breakout system; in a
 * slow grinding bear it stays flat (safe but no profit). It can also enter a
 * false squeeze that immediately reverses and hits the stop.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }
  const entryHigh = ctx.high(20, 2); // 20-bar high, 2 bars back (excludes last closed bar)
  const exitLow = ctx.low(10, 2);    // 10-bar low, 2 bars back
  const atrS = ctx.atr(14, 1);       // short-term vol
  const atrL = ctx.atr(60, 1);       // long-term vol
  if (entryHigh == null || exitLow == null || atrS == null || atrS <= 0 || atrL == null || atrL <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atrS;
    if (price <= hardStop || prevClose < exitLow) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: exitLow, trigger: 'below', note: '10d low exit' }]);
    return null;
  }

  // Volatility-targeted size: risk a fixed 1% of equity per position via a
  // 2x ATR stop, capped at 40% of equity so low-vol coins cannot over-leverage.
  const riskPerTrade = 0.01 * ctx.cash;
  let qty = riskPerTrade / (2 * atrS);
  const maxQty = (ctx.cash / price) * 0.40;
  qty = Math.min(qty, maxQty);

  // Squeeze condition: current volatility below its own longer-term average
  // (coiled) AND price breaks the 20-day high (release). ATR14/price < ATR60/price
  // means short-term vol is compressing relative to its recent history.
  const squeeze = (atrS / price) < (atrL / price);
  if (prevClose > entryHigh && squeeze) {
    ctx.watch([]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '20d breakout entry',
               conds: [{ label: 'squeeze (ATR14<ATR60 rel)', ok: squeeze }] }]);
  return null;
}
