/*
 * @coinsori-strategy v1
 * name: XRP Turtle ATR Stop 4H
 * ex: binance
 * syms: XRP/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The Donchian turtle engine (55-bar high breakout + rising
 * 200-SMA entry, 20-bar low breakdown exit, volatility-scaled 2.5x ATR stop)
 * has held up on BTC, ETH and SOL 4h. This is the same engine, unchanged,
 * applied to XRP to test whether the edge generalizes to another major alt.
 * When it buys and sells: buy when a closed 4h bar exceeds the highest high of
 * the prior 55 closed bars AND the 200-SMA is rising. Sell on a 2.5x ATR stop,
 * or when a closed bar falls below the lowest low of the prior 20 bars.
 * When it does NOT work: whipsaws in sideways ranges, lags fresh bulls from a
 * falling 200-SMA, and the tighter ATR stop means more stop-outs than a fixed
 * percent stop in choppy markets.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 260) return null;
  const prevClose = c.at(-2);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);   // 200-SMA 20 bars earlier -> slope check

  // Donchian levels from CLOSED bars, EXCLUDING the signal bar itself
  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));   // 55 prior bars
  let l20 = Infinity;
  for (let k = 3; k <= 22; k++) l20 = Math.min(l20, c.at(-k));   // 20 prior bars (exit)

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    // stop scaled to market volatility — same 2.5x ATR as the proven BTC/ETH engine
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2.5;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l20) return { side: 'sell', qty: pos };   // 20-bar low breakdown
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: l20, trigger: 'below', note: '20-bar low breakdown' }]);
    return null;
  }

  if (sma200 == null || sma200Prev == null) return null;
  if (!(prevClose > h55)) return null;                       // breakout
  if (!(sma200 > sma200Prev)) return null;                   // 200-SMA must be RISING

  const atrPct = atr / prevClose;
  // 4h ATR% is ~1.5-2.5%, so target 1.5% ATR per bar to deploy real capital
  const volScale = Math.min(1, 0.015 / atrPct);
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true }] }]);
  return { side: 'buy', qty };
}
