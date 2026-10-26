/*
 * @coinsori-strategy v1
 * name: BTC Onchain-Gated Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin price trends that are backed by growing blockchain
 * usage (more daily active addresses) tend to persist longer than pure price
 * breakouts, so we only join a breakout when on-chain adoption is also rising.
 * When it buys and sells: buys when the daily close makes a new 20-day high AND
 * the 30-day average of active addresses is above its own 30-day average (usage
 * growing). Sells when the close breaks below the 10-day low or price falls
 * 2.5x ATR below entry as a safety stop.
 * When it does NOT work: in sideways chop it whipsaws; in bull runs driven by
 * speculation before usage catches up it stays out too long; it is always long
 * or flat, so it cannot profit from falling markets.
 */
function onUpdate(ctx) {
  const ENTRY_N = 20;    // breakout lookback in days
  const EXIT_N = 10;     // exit lookback in days
  const ATR_STOP = 2.5;  // hard stop: 2.5x daily ATR below entry
  const RISK = 0.02;     // fraction of equity risked per trade

  // closed-bar values only (ago>=1 is identical in backtest and live)
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const breakoutHigh = ctx.high(ENTRY_N, 2); // highest high of previous 20 closed bars
  const exitLow = ctx.low(EXIT_N, 2);        // lowest low of previous 10 closed bars
  const atr = ctx.atr(14, 1);
  if (breakoutHigh == null || exitLow == null || atr == null) return null;

  // on-chain adoption: current active addresses vs their 30-day average
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  if (addr == null || addrSma == null) return null;
  const adoptionGrowing = addr > addrSma;

  const pos = ctx.position || 0;
  const price = ctx.price;

  // ---- EXIT ----
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry == null) return null;
    const stopPx = entry - ATR_STOP * atr;
    ctx.watch([
      { side: 'sell', price: exitLow, trigger: 'below', note: '10d low exit' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '2.5x ATR stop' }
    ]);
    if (prevClose < exitLow || price <= stopPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // ---- ENTRY: breakout + adoption growing ----
  if (prevClose > breakoutHigh && adoptionGrowing) {
    // size so a stop-out (ATR_STOP*ATR move) loses RISK of equity
    const riskAmt = ctx.cash * RISK;
    const stopDist = ATR_STOP * atr;
    if (stopDist <= 0) return null;
    const qty = Math.min(riskAmt / stopDist, (ctx.cash / price) * 0.98);
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', price: breakoutHigh, trigger: 'above', note: '20d high + usage up' }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([{ side: 'buy', price: breakoutHigh, trigger: 'above', note: '20d high breakout' }]);
  return null;
}
