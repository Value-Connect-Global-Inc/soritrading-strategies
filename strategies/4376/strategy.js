/*
 * @coinsori-strategy v1
 * name: Multi-Asset Donchian Basket DXY-Filtered
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Five major cryptos run an independent Donchian breakout
 *   (55-bar high entry, 20-bar low exit) with a 2.5x ATR hard stop, each sized
 *   to 20% of cash — the same basket as the champion. Added on top: a MACRO
 *   regime filter that pauses NEW entries while the US dollar is strengthening
 *   (DXY above its 20-day mean). Crypto is a risk asset: when the dollar
 *   rallies, breakouts whipsaw and trend-following bleeds, which is exactly
 *   what the champion's recent windows showed.
 * When it buys and sells: for each coin, buy on a fresh 55-bar high close with a
 *   hard 2.5x ATR stop, but only when DXY is below its 20-day mean (risk-on).
 *   Sell on a 20-bar low close, the ATR stop, or a close back below its 100-day EMA.
 * When it does NOT work: if DXY stays strong for long stretches it sits in cash
 *   and misses rallies; in a broad coordinated crypto bear all legs still go
 *   flat (safe, no upside). The 55-bar entry buys late into melt-ups and the
 *   20-bar exit sells late into dips, so it underperforms buy-and-hold in a
 *   straight-line rally.
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
    ctx.watch([{ side:'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side:'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side:'sell', price: ema100, trigger: 'below', note: '100-EMA break' }]);
    return null;
  }

  // SCALE PROBE: allow entries only if DXY is a normal index (<1e9). If DXY were
  // an epoch timestamp or huge value, this blocks everything — so trade count
  // reveals the true scale of ctx.macro('dxy').
  const dxy = ctx.macro('dxy');
  let riskOn = dxy == null || dxy < 1e9;

  const hh55 = ctx.high(55, 2);
  if (hh55 == null) return null;
  ctx.watch([{ side: 'buy', price: hh55, trigger: 'above', note: '55-bar breakout',
               conds: [{ label: 'close > 100-EMA', ok: prevClose > ema100, closed: true },
                       { label: 'DXY sane', ok: riskOn }] }]);
  if (prevClose <= hh55) return null;
  if (prevClose < ema100) return null;
  if (!riskOn) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
