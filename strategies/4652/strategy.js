/*
 * @coinsori-strategy v1
 * name: XRP Donchian Turtle 4H
 * ex: binance
 * syms: XRP/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Same proven turtle trend-following engine that works on
 * BTC/ETH/SOL 4h, applied to XRP for cross-asset diversification. XRP makes
 * sustained moves that start with a breakout above the 55-bar high; riding that
 * until a 20-bar low breakdown captures the trend while a 15% hard stop protects
 * against false starts. A rising-200-SMA filter keeps it out of breakouts inside
 * a topping range where the classic turtle whipsaws.
 * When it buys and sells: buy when the last closed 4h bar exceeds the highest
 * high of the prior 55 closed bars AND the 200-SMA is rising (higher than it was
 * 20 bars ago). Sell when a closed bar falls below the lowest low of the prior 20
 * closed bars, or a 15% hard stop is hit.
 * When it does NOT work: it whipsaws in a sideways range above a flat 200-SMA
 * and lags the very start of a fresh bull that begins from a falling 200-SMA.
 * It loses in a fast crash because the 15% stop is wide.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 260) return null;
  const prevClose = c.at(-2);
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);   // 200-SMA 20 bars earlier -> slope check

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

  if (sma200 == null || sma200Prev == null) return null;
  if (!(prevClose > h55)) return null;                       // breakout
  if (!(sma200 > sma200Prev)) return null;                   // 200-SMA must be RISING

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);   // 4h noise: target 1.5% ATR, cap size
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
