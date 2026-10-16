/*
 * @coinsori-strategy v1
 * name: BTC Turtle Fast Exit 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The proven BTC 4h Donchian turtle (55-bar breakout entry + 200-SMA rising filter) exits on a 20-bar low breakdown. This is the fast-exit variant: a 10-bar low breakdown exit, so positions are closed quickly once momentum turns, capturing shorter moves and giving back less. Opposite end of the exit-length axis from the slow-exit variant tested this cycle.
 * When it buys and sells: buy on a 55-bar high breakout when the 200-SMA is rising; sell on the 2.5x ATR stop or when the close drops below the 10-bar low.
 * When it does NOT work: whipsaws in chop — a 10-bar low is hit often during sideways price action, so it can be stopped out and re-enter repeatedly.
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
  const sma200Prev = ctx.sma(200, 21);

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));
  let l10 = Infinity;
  for (let k = 3; k <= 12; k++) l10 = Math.min(l10, c.at(-k));

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2.5;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l10) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: l10, trigger: 'below', note: '10-bar low breakdown' }]);
    return null;
  }

  if (sma200 == null || sma200Prev == null) return null;
  if (!(prevClose > h55)) return null;
  if (!(sma200 > sma200Prev)) return null;

  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true }] }]);
  return { side: 'buy', qty };
}
