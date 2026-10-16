/*
 * @coinsori-strategy v1
 * name: BTC Donchian Turtle 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Classic turtle trend-following. BTC makes sustained moves
 * that start with a breakout above the 55-bar high; riding that until the trend
 * breaks down captures the move while the stop protects against false starts.
 * This is a different mechanism (Donchian) than the EMA-based champion, so it
 * adds a fully independent trend family.
 * When it buys and sells: buy when the last closed 4h bar exceeds the highest
 * high of the prior 55 closed bars (breakout). Sell when a closed bar falls below
 * the highest high of the prior 20 bars minus 3x ATR(14) (chandelier exit), or a
 * 15% hard stop is hit.
 * When it does NOT work: in a long sideways range it whipsaws — every breakout
 * is followed by a breakdown and it pays fees on both. It also lags the very
 * start of a move (55 bars is a long lookback) so early trend followers profit
 * before it enters.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 62) return null;
  const prevClose = c.at(-2);

  // Donchian entry level from CLOSED bars, EXCLUDING the signal bar itself
  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));   // 55 prior bars

  const atr = ctx.atr(14, 1);

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;   // hard stop 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (atr != null) {
      // chandelier: highest high of prior 20 bars (excluding signal bar) minus 3*ATR
      let h20 = -Infinity;
      for (let k = 3; k <= 22; k++) h20 = Math.max(h20, c.at(-k));
      const trail = h20 - 3 * atr;
      if (prevClose < trail) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
                 { side: 'sell', price: trail, trigger: 'below', note: '3xATR chandelier' }]);
      return null;
    }
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' }]);
    return null;
  }

  if (!(prevClose > h55)) return null;   // 55-bar high breakout

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout' }]);

  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);   // 4h noise: target 1.5% ATR, cap size
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
