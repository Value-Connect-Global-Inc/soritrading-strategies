/*
 * @coinsori-strategy v1
 * name: 1D BB-Squeeze Breakout Basket
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Big crypto trends usually start from a quiet coil: when
 *   Bollinger bandwidth squeezes to its narrowest in 60 days, the next upside
 *   break of the upper band is a volatility-expansion breakout — a different
 *   trigger than the champion's fixed 55-day high. The squeeze filters out the
 *   many noisy breakouts the champion takes.
 * When it buys and sells: buy when today's close breaks above the 20-day upper
 *   Bollinger band while bandwidth is at its tightest in 60 days. Sell on a
 *   close back below the 20-day middle band, or a 2.5x ATR hard stop.
 * When it does NOT work: in a slow drift up with no squeeze it never triggers
 *   (misses gentle rallies); in a 2018-style grinding bear it stays flat
 *   (safe, no upside). It is fully invested only when volatility expands.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const bb = ctx.bb(20, 2, 1);
  if (atr == null || atr <= 0 || bb == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (prevClose <= bb.mid) return { side: 'sell', qty: pos };  // lost the expansion
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: bb.mid, trigger: 'below', note: 'BB middle' }]);
    return null;
  }

  // bandwidth squeeze: current width is the tightest in the last 60 bars
  const width = (bb.upper - bb.lower) / bb.mid;
  let tightest = true;
  for (let i = 1; i <= 60; i++) {
    const b = ctx.bb(20, 2, i);
    if (b == null) { tightest = false; break; }
    const w = (b.upper - b.lower) / b.mid;
    if (w < width) { tightest = false; break; }
  }
  if (!tightest) return null;

  ctx.watch([{ side: 'buy', price: bb.upper, trigger: 'above', note: 'BB squeeze break',
               conds: [{ label: 'close > BB upper', ok: prevClose > bb.upper, closed: true },
                       { label: 'bandwidth tightest 60d', ok: true, closed: true }] }]);
  if (prevClose <= bb.upper) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.25;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
