/*
 * @coinsori-strategy v1
 * name: Fed-Easing Gated Donchian BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto behaves like a risk asset — it rallies when central
 *   banks are easing (fed funds falling) and struggles when policy tightens.
 *   This strategy only takes Donchian breakouts when the US fed funds rate is
 *   falling (current rate below its level 30 days ago), so trend entries are
 *   gated by the macro regime instead of taken blindly.
 * When it buys and sells: buy on a fresh 55-bar high close only when fed funds
 *   are easing. Sell on a 20-bar low close, a 2.5x ATR hard stop, or a close
 *   back below the 100-day EMA.
 * When it does NOT work: in a strong crypto bull that runs against a tightening
 *   fed (e.g. 2017, late 2020) it sits in cash and misses the rally; the fed
 *   rate only changes monthly so the gate is slow to flip.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || atr <= 0 || ema100 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Macro regime: fed funds easing = current rate below the rate 30 days ago.
  const fed = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  const easing = fed != null && fedLag != null && fedLag > 0 && fed < fedLag;

  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA break' }]);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };
    return null;
  }

  const hh55 = ctx.high(55, 2);
  if (hh55 == null) return null;
  ctx.watch([{ side: 'buy', price: hh55, trigger: 'above', note: '55-bar breakout',
               conds: [{ label: 'fed easing (rate < 30d ago)', ok: easing, closed: true },
                       { label: 'close > 100-EMA', ok: prevClose > ema100, closed: true }] }]);
  if (prevClose <= hh55) return null;  // need a fresh 55-bar high close
  if (prevClose < ema100) return null;
  if (!easing) return null;  // macro gate: only enter when fed is easing

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.9;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
