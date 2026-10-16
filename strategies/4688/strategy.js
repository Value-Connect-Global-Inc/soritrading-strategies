/*
 * @coinsori-strategy v1
 * name: BTC Turtle Chandelier 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The proven BTC 4h Donchian turtle (55-bar breakout, 200-SMA rising filter) exits on a 20-bar low breakdown, which gives back a lot of profit during strong trends. Replacing that exit with a trailing ATR stop from the highest close since entry should lock in more of the move.
 * When it buys and sells: same entry as the base turtle — buy on a 55-bar high breakout when the 200-SMA is rising. Exit: sell when price falls below the chandelier stop (3x ATR below the highest close since entry) or the 2.5x ATR initial stop.
 * When it does NOT work: the same chop/no-breakout regime as any turtle, and it can get stopped out of a trend earlier than the 20-bar low version, missing a later re-entry.
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
  let l20 = Infinity;
  for (let k = 3; k <= 22; k++) l20 = Math.min(l20, c.at(-k));

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const st = ctx.state || {};
    let hi = st.hi || 0;
    if (prevClose > hi) hi = prevClose;   // highest CLOSED bar since entry
    const chand = hi - atr * 3.0;         // classic chandelier: 3x ATR trail
    const hard = ctx.entryPx == null ? null : ctx.entryPx - atr * 2.5;
    ctx.state = { hi };
    if (hard != null && price <= hard) return { side: 'sell', qty: pos };
    if (price <= chand) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: chand, trigger: 'below', note: 'chandelier 3x ATR' },
               { side: 'sell', price: hard, trigger: 'below', note: '2.5x ATR stop' }]);
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
