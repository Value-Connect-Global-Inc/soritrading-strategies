/*
 * @coinsori-strategy v1
 * name: MeanReversionDips
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: in a bull market, sharp daily dips are usually temporary —
 * price snaps back to the short-term average within days. Buying those dips while
 * the long-term trend is still up is a different bet than trend-following: it
 * profits from mean reversion instead of momentum.
 * When it buys and sells: buys when the price is oversold (RSI below 35 AND price
 * below the lower Bollinger band) but ONLY while price is above its 200-day average
 * (uptrend regime — never catch a falling knife in a bear). Sells when the price
 * recovers back above its 20-day average, when the trend breaks, or on a hard 2x
 * ATR stop below entry. Trades at half size because dip-catching is risky.
 * When it does NOT work: in a strong downtrend it stays flat (regime filter), and
 * in a fast crash the dip keeps falling and the 2x ATR stop takes the loss.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const rsi = ctx.rsi(14, 1);
  const s200 = ctx.sma(200, 1);
  const s20 = ctx.sma(20, 1);
  const bb = ctx.bb(20, 2, 1);
  const atr = ctx.atr(14, 1);
  if (rsi == null || s200 == null || s20 == null || bb == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  const inUptrend = prevClose > s200; // only buy dips in an uptrend — avoids bear-market knives

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    const reverted = prevClose > s20; // dip fully recovered back to the short-term average
    if (price <= hardStop || reverted || !inUptrend) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' }]);
    return null;
  }

  // 35 instead of 30: still clearly oversold, but triggers often enough to matter
  // (the strict AND gave only 6/4 trades over 3 years — effectively inactive).
  const oversold = rsi < 35 && prevClose < bb.lower;
  if (inUptrend && oversold) {
    // Half position: buying a falling knife, so never risk the whole account on one dip.
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.5 };
  }
  ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'oversold dip entry', conds: [
    { label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true },
    { label: 'Close > SMA200', ok: inUptrend, closed: true }
  ]}]);
  return null;
}
