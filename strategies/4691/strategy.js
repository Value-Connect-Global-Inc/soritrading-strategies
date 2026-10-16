/*
 * @coinsori-strategy v1
 * name: BTC Turtle VolRegime 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The proven BTC 4h Donchian turtle (55-bar breakout entry + 200-SMA rising filter) takes every breakout. Breakouts that happen while volatility is low/contracting are often false — price pokes a high and fades. This variant only enters when volatility is EXPANDING: ATR(14)/price above its own 100-bar average. Same entry/exit otherwise.
 * When it buys and sells: buy on a 55-bar high breakout when the 200-SMA is rising AND ATR/price is above its 100-bar average; sell on the 2.5x ATR stop or the 20-bar low breakdown.
 * When it does NOT work: in a long quiet grind the filter keeps you out of valid slow trends; in a fast crash the filter may also let whipsaws through.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 320) return null;
  const prevClose = c.at(-2);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));
  let l20 = Infinity;
  for (let k = 3; k <= 22; k++) l20 = Math.min(l20, c.at(-k));

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2.5;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: l20, trigger: 'below', note: '20-bar low breakdown' }]);
    return null;
  }

  if (sma200 == null || sma200Prev == null) return null;
  if (!(prevClose > h55)) return null;
  if (!(sma200 > sma200Prev)) return null;

  // volatility-regime filter: current vol vs its own 100-bar average
  const atrPct = atr / prevClose;
  let sum = 0, n = 0;
  for (let k = 2; k <= 101; k++) {
    const a = c.at(-k);
    if (!Number.isFinite(a)) continue;
    const base = c.at(-k - 1);
    if (!Number.isFinite(base) || base <= 0) continue;
    const r = Math.abs(a - base) / base;
    sum += r; n++;
  }
  if (n < 50) return null;
  const avgVol = sum / n;
  if (!(atrPct > avgVol)) return null;

  const volScale = Math.min(1, 0.015 / atrPct);
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true },
                       { label: 'vol expanding', ok: atrPct > avgVol, closed: true }] }]);
  return { side: 'buy', qty };
}
