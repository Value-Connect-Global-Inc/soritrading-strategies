/*
 * @coinsori-strategy v1
 * name: BTC Donchian Turtle 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Classic turtle trend-following. BTC makes sustained moves
 * that start with a breakout above the 55-bar high; riding that until a 20-bar
 * low breakdown captures the trend while the stop protects against false starts.
 * Adding the 200-SMA filter avoids the classic turtle trap of buying every
 * breakout in a long sideways range.
 * When it buys and sells: buy when the last closed 4h bar exceeds the highest
 * high of the prior 55 closed bars AND price is above the 200-SMA. Sell when a
 * closed bar falls below the lowest low of the prior 20 closed bars, or a 15%
 * hard stop is hit.
 * When it does NOT work: in a long sideways range below the 200-SMA it stays
 * out (good), but in a choppy range ABOVE the 200-SMA it still whipsaws. It
 * also lags the very start of a move (55-bar lookback) so early movers profit
 * before it enters, and it misses the start of a fresh bull that begins below
 * the 200-SMA.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 62) return null;
  const prevClose = c.at(-2);
  const sma200 = ctx.sma(200, 1);

  // Donchian levels from CLOSED bars, EXCLUDING the signal bar itself
  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));   // 55 prior bars
  let l20 = Infinity;
  for (let k = 3; k <= 22; k++) l20 = Math.min(l20, c.at(-k));   // 20 prior bars

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;   // hard stop 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l20) return { side: 'sell', qty: pos };   // 20-bar low breakdown
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: l20, trigger: 'below', note: '20-bar low breakdown' }]);
    return null;
  }

  const trendOk = sma200 == null ? true : prevClose > sma200;
  if (!(prevClose > h55) || !trendOk) return null;   // breakout + above 200-SMA

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: 'close > 200-SMA', ok: trendOk, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);   // 4h noise: target 1.5% ATR, cap size
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
