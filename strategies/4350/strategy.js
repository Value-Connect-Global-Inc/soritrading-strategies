/*
 * @coinsori-strategy v1
 * name: Weak-Dollar Gated Donchian Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto is a risk asset that thrives when the US dollar is
 *   weak (falling dollar index) and suffers when the dollar strengthens. This
 *   takes the validated 5-coin Donchian breakout basket but only enters when
 *   the dollar index is below its level 60 bars earlier — a macro regime gate on
 *   top of a proven trend recipe, a different axis from the un-gated basket.
 * When it buys and sells: for each coin, buy on a fresh 55-bar high close only
 *   when the dollar is weak. Sell on a 20-bar low close, a 2.5x ATR stop, or a
 *   close back below the 100-day EMA.
 * When it does NOT work: in a crypto bull that runs while the dollar is
 *   strengthening it sits out the rally; the dollar index is daily and slow, so
 *   the gate lags sudden regime turns.
 */
const dxyHist = [];

function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || atr <= 0 || ema100 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Macro regime: weak dollar = current DXY below its level 60 bars ago.
  const dxyNow = ctx.data('dxy');
  if (dxyNow != null) dxyHist.push(dxyNow);
  const dxyPrev = dxyHist.length > 60 ? dxyHist[dxyHist.length - 61] : null;
  const weakDollar = dxyNow != null && dxyPrev != null && dxyPrev > 0 && dxyNow < dxyPrev;

  const pos = ctx.pos(sym);

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
               conds: [{ label: 'weak dollar (DXY < 60d ago)', ok: weakDollar, closed: true },
                       { label: 'close > 100-EMA', ok: prevClose > ema100, closed: true }] }]);
  if (prevClose <= hh55) return null;
  if (prevClose < ema100) return null;
  if (!weakDollar) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20; // cap each leg at 20% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
