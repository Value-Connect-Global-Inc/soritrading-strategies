/*
 * @coinsori-strategy v1
 * name: BTC Easy-Money Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A 55-day Donchian breakout is a proven trend signal on BTC, but it buys
 * every breakout including false ones during monetary tightening. Bitcoin is a liquidity asset —
 * when the US federal funds rate is low, money is cheap and risk assets rally; when it is high,
 * capital is expensive and BTC struggles. We gate the breakout on an easy-money regime.
 * When it buys and sells: buys when price closes above its 55-day high AND the fed funds rate
 * (lagged 30 days) is below 3% (easy-money regime). Sells on a 2x ATR stop or when price closes
 * below its 55-day low. Position size shrinks when volatility is high.
 * When it does NOT work: in choppy sideways markets with repeated false breakouts the stop takes
 * small losses; and BTC can rally even with high rates (liquidity-led moves) so the gate misses
 * those. Needs the fed_lag30 dataset connected.
 */
const fedHist = []; // module-level history of lagged fed funds rate, one per bar

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const fed = ctx.data('fed_lag30');
  if (fed == null) return null; // macro data missing — never treat null as 0
  fedHist.push(fed);

  const c = ctx.closes;
  if (c.length < 120) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));
  let l55 = Infinity;
  for (let k = 3; k <= 57; k++) l55 = Math.min(l55, c.at(-k));

  const prevClose = c.at(-2);
  const pos = ctx.position;

  // Exit first: 2x ATR hard stop or 55-day low breakdown
  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l55) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: l55, trigger: 'below', note: '55-bar low breakdown' }]);
    return null;
  }

  if (!(prevClose > h55)) {
    ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout' }]);
    return null;
  }

  // Easy-money gate: fed funds (lagged 30d) below 3% — cheap capital favours risk assets.
  // 3% separates the 2017-19 (<=2.4), 2020-21 (~0) and 2024-25 (<=4.3) regimes from the
  // 2022-23 tightening (>=4.5) where BTC trend-following bled out.
  const easy = fed < 3;
  if (!easy) {
    ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
                 conds: [{ label: 'fed funds < 3%', ok: easy, closed: true }] }]);
    return null;
  }

  // ATR-scaled sizing: cut exposure when volatility is high (target 1.5% of price per ATR)
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);
  const qty = (ctx.cash * 0.99 * volScale) / price;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: 'fed funds < 3%', ok: easy, closed: true }] }]);
  return { side: 'buy', qty };
}
