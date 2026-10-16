/*
 * @coinsori-strategy v1
 * name: Crypto Weak-Dollar Trend 1D (BTC/ETH/SOL)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto is an anti-dollar asset class — when the US dollar weakens, dollar-priced
 * risk assets tend to rise. A Donchian breakout trend trade on each of BTC/ETH/SOL is gated on a
 * weakening dollar (DXY 20-day change negative) so we only chase strength against the macro
 * headwind, and sit out when the dollar is firming.
 * When it buys and sells: on each asset, buys when a closed bar breaks the 55-day high AND the
 * DXY 20-day change is negative. Sells on a 2x ATR stop or when a closed bar breaks the 55-day low.
 * Per-asset position is scaled down by volatility and capped at one third of equity.
 * When it does NOT work: the dollar and crypto occasionally decouple (crypto-specific crashes,
 * liquidity squeezes) so the gate adds no protection then and can delay entries. Needs the dxy
 * dataset connected.
 */
const dxyHist = []; // module-level history of DXY values, one per bar (shared across symbols)

function onUpdate(ctx) {
  const raw = ctx.data('dxy');
  const dxy = raw == null ? null : Number(raw);
  if (dxy == null || !Number.isFinite(dxy)) return null; // macro data not available — never treat null as 0
  // push only on a new bar (all symbols see the same DXY at the same bar, so dedupe by value)
  if (dxyHist.length === 0 || dxyHist[dxyHist.length - 1] !== dxy) dxyHist.push(dxy);
  if (dxyHist.length < 25) return null;

  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 120) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));
  let l55 = Infinity;
  for (let k = 3; k <= 57; k++) l55 = Math.min(l55, c.at(-k));

  const prevClose = c.at(-2);
  const pos = ctx.pos(sym);

  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l55) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: l55, trigger: 'below', note: '55-bar low breakdown' }]);
    return null;
  }

  // dollar must be weakening (20-day change negative) to enter — macro regime gate
  const dxy20 = dxyHist.length >= 21 ? dxyHist[dxyHist.length - 21] : null;
  const dollarWeak = dxy20 != null && dxy < dxy20;

  if (!(prevClose > h55) || !dollarWeak) {
    ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
                 conds: [{ label: 'DXY 20d weaker', ok: dollarWeak, closed: true }] }]);
    return null;
  }

  // ATR-scaled sizing: cut exposure when volatility is high (target 1.5% of price per ATR),
  // and never risk more than one third of equity on a single asset.
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);
  const qty = (ctx.cash * 0.99 / price) / 3 * volScale;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: 'DXY 20d weaker', ok: dollarWeak, closed: true }] }]);
  return { side: 'buy', qty };
}
