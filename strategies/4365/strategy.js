/*
 * @coinsori-strategy v1
 * name: Donchian Basket Volatility-Scaled Sizing 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same 5-coin Donchian breakout basket as the champion
 *   (55-bar high entry, 20-bar low exit, 2.5x ATR hard stop) but the position
 *   cap per leg shrinks when a coin is in a panic-volatility regime (ATR% above
 *   6%). Breakouts bought into extreme volatility fail more often, so sizing
 *   down then protects capital without touching the proven entry/exit rules.
 * When it buys and sells: buy on a fresh 55-bar high close above the 100-day
 *   EMA. Sell on a 20-bar low close, the 2.5x ATR hard stop, or a close below
 *   the 100-day EMA. Leg cap is 20% of cash normally, 8% when ATR% > 6%.
 * When it does NOT work: in a broad coordinated crypto bear all five legs go
 *   flat (safe, no upside); the 55-bar entry still buys late into melt-ups; and
 *   if a huge trend starts from a panic-volatility regime, the small position
 *   size caps the profit on that leg — it trades safety for upside.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || atr <= 0 || ema100 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA break' }]);
    return null;
  }

  const hh55 = ctx.high(55, 2);
  if (hh55 == null) return null;  // not enough history yet
  ctx.watch([{ side: 'buy', price: hh55, trigger: 'above', note: '55-bar breakout',
               conds: [{ label: 'close > 100-EMA', ok: prevClose > ema100, closed: true }] }]);
  if (prevClose <= hh55) return null;  // need a fresh 55-bar high close
  if (prevClose < ema100) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const atrPct = atr / price;
  // panic regime: shrink the leg cap so we are not full-size into high-vol breakouts
  const capPct = atrPct > 0.06 ? 0.08 : 0.20;
  const maxQty = (ctx.cash / price) * capPct;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
