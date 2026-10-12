/*
 * @coinsori-strategy v1
 * name: DonchianAddrGate
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sustained trends in BTC start with a breakout and are backed
 * by real network use. When active addresses are above their 30-day average, the
 * breakout is adoption-driven — not just speculation. Gating the classic Turtle
 * breakout on this on-chain regime filters out fake breakouts in quiet markets.
 * When it buys and sells: buys full position when the previous close is a new
 * 55-day high AND active addresses are above their 30-day average; sells on a
 * 20-day low or a hard 2x ATR stop below entry.
 * When it does NOT work: on-chain data lags price, so the gate can be late; in a
 * sideways market breakouts still whipsaw. If addresses never confirm, it stays
 * in cash and misses the move entirely.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const entryHigh = ctx.high(55, 2); // 55-bar high, 2 bars back (excludes last closed bar)
  const exitLow = ctx.low(20, 2);    // 20-bar low, 2 bars back (excludes last closed bar)
  const atr = ctx.atr(14, 1);
  if (entryHigh == null || exitLow == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop || prevClose < exitLow) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' }]);
    return null;
  }

  // On-chain regime gate: active addresses above their 30-day average = real
  // network adoption, so the breakout is more likely to follow through.
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const gateOn = addr != null && addrSma != null && addr > addrSma;

  if (prevClose > entryHigh && gateOn) {
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout entry' }]);
  return null;
}
