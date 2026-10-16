/*
 * @coinsori-strategy v1
 * name: SOL DXY Regime Trend 1D
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto risk assets are liquidity-driven. When the US
 * dollar is in a weak regime (dxy below its own 60-day average), global
 * liquidity flows toward risk, which is a tailwind for SOL. This is a
 * different family from price-breakout following — it bets on a macro
 * liquidity regime, not on a breakout.
 * When it buys and sells: buy when SOL is above its 200-SMA (uptrend context)
 * AND dxy is below its 60-day average (weak-dollar regime). Sell when the
 * dollar turns strong (dxy above its 60-day average), SOL breaks below the
 * 200-SMA, or a 2.5x ATR stop is hit.
 * When it does NOT work: the dollar regime is a slow, lagging signal — it can
 * keep the strategy long while SOL already topped, and it misses fresh rallies
 * that start while the dollar is still strong. In a dollar-strength regime it
 * stays flat and earns nothing.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 220) return null;
  const prevClose = c.at(-2);

  // dxy is business-days only (FRED): forward-fill the last known value on null bars
  const dxyRaw = ctx.data('dxy');
  let dxy = ctx.state.lastDxy;
  if (dxyRaw != null && Number.isFinite(dxyRaw)) {
    dxy = dxyRaw;
    ctx.state.lastDxy = dxy;
  }
  if (dxy == null || !Number.isFinite(dxy)) return null;   // no dxy data at all yet

  // Rolling history of dxy (~60 days) for the regime average
  if (ctx.state.dxyHist == null) ctx.state.dxyHist = [];
  ctx.state.dxyHist.push(dxy);
  if (ctx.state.dxyHist.length > 60) ctx.state.dxyHist.shift();
  if (ctx.state.dxyHist.length < 60) return null;   // need a full 60-day window

  let dxySum = 0;
  for (let k = 0; k < 60; k++) dxySum += ctx.state.dxyHist[k];
  const dxyAvg60 = dxySum / 60;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2.5;
    const dollarStrong = dxy > dxyAvg60;   // dollar turned strong -> exit
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < sma200 || dollarStrong) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' }]);
    return null;
  }

  const dollarWeak = dxy < dxyAvg60;   // weak-dollar regime
  if (prevClose > sma200 && dollarWeak) {
    const qty = (ctx.cash * 0.95 / price) * 0.95;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'regime long',
                 conds: [{ label: 'dollar weak regime', ok: dollarWeak, closed: true }] }]);
    return { side: 'buy', qty };
  }
  return null;
}
