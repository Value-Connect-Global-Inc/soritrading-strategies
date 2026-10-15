/*
 * @coinsori-strategy v1
 * name: 4H Momentum Ride (BTC)
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On the 4-hour chart Bitcoin trends are shorter and sharper
 * than on daily charts, so a faster trend rule can catch moves the 1-day
 * strategies miss. We ride the 4h trend while it is up and step aside when it
 * turns down.
 * When it buys and sells: buys when the last CLOSED 4h bar is above the 100-bar
 * EMA and its 24-bar return is positive. Sells when the closed bar drops below
 * the 100-bar EMA, the 24-bar return turns negative, or a 6% hard stop is hit.
 * When it does NOT work: in a choppy sideways market the faster signals flip
 * more often and the 6% stop is hit on normal 4h noise — it whipsaws and pays
 * fees. The 4h timeframe is noisier than 1d, so this is a higher-churn, higher
 * fee strategy than the daily champions.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema100 = ctx.ema(100, 1);
  if (ema100 == null) return null;

  const c = ctx.closes;
  if (c.length < 26) return null;
  const prevClose = c.at(-2);
  const mom24 = prevClose / c.at(-26) - 1;   // 24-bar (~4 day) return of the last CLOSED bar

  // volatility target: size so the position contributes ~2% daily vol to the pool
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.94;          // hard stop: 6% below entry (4h noise)
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };   // trend over
    if (mom24 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '6% stop' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-bar trend break',
                 conds: [{ label: '24-bar return > 0', ok: mom24 > 0, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema100;
  ctx.watch([{ side: 'buy', price: ema100, trigger: 'above', note: 'close above 100-bar EMA',
               conds: [{ label: '24-bar return > 0', ok: mom24 > 0, closed: true },
                       { label: 'close > 100-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !(mom24 > 0)) return null;

  const targetCash = ctx.cash * volScale;      // single-asset pool, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
