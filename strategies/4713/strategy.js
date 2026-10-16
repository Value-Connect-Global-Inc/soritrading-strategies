/*
 * @coinsori-strategy v1
 * name: BTC Weak-Dollar Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto is an anti-dollar asset — when the US dollar weakens, dollar-priced
 * risk assets like BTC tend to rise, and when it strengthens they tend to fall. Gating a BTC
 * trend-following trade on a weakening dollar avoids fighting the macro headwind.
 * When it buys and sells: buys BTC when price closes above its 55-day high AND the dollar index
 * (DXY) is weaker than 20 days ago (20-day change negative). Sells on a 2x ATR stop or when price
 * closes below its 55-day low.
 * When it does NOT work: the dollar and crypto occasionally decouple (crypto-specific crashes,
 * liquidity squeezes) so the DXY gate adds no protection then and can delay entries. Needs the
 * dxy dataset connected.
 */
const dxyHist = []; // module-level history of DXY values, one per bar

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const dxy = ctx.data('dxy');
  if (dxy == null) return null; // macro data not available — never treat null as 0
  dxyHist.push(dxy);
  if (dxyHist.length < 25) return null;

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

  // dollar must be weakening (20-day change negative) to enter — macro regime gate.
  // Compare the bar 20 days ago with today's DXY.
  const dxy20 = dxyHist.length >= 21 ? dxyHist[dxyHist.length - 21] : null;
  if (dxy20 == null || !(dxy < dxy20)) {
    ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
                 conds: [{ label: 'DXY 20d weaker', ok: dxy < dxy20, closed: true }] }]);
    return null;
  }

  // ATR-scaled sizing: cut exposure when volatility is high (target 1.5% of price per ATR)
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);
  const qty = (ctx.cash * 0.99 * volScale) / price;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: 'DXY 20d weaker', ok: dxy < dxy20, closed: true }] }]);
  return { side: 'buy', qty };
}
