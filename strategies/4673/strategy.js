/*
 * @coinsori-strategy v1
 * name: SOL DXY Regime Trend 1D
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto risk assets are liquidity-driven. When the US
 * dollar weakens (dxy falling), global liquidity flows toward risk, which is
 * a tailwind for SOL. This is a different family from price-breakout
 * following — it bets on a macro liquidity regime, not on a breakout.
 * When it buys and sells: buy when SOL is above its 200-SMA (uptrend context)
 * AND the dollar has been falling over the last ~30 days. Sell when the dollar
 * starts rising again, SOL breaks below the 200-SMA, or a 2.5x ATR stop is hit.
 * When it does NOT work: dollar weakness is a slow, lagging signal — it can
 * keep the strategy long while SOL already topped, and it misses fresh rallies
 * that start while the dollar is still firm. In a dollar-strength regime it
 * stays flat and earns nothing.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 220) return null;
  const prevClose = c.at(-2);

  const dxy = ctx.data('dxy');
  if (dxy == null || !Number.isFinite(dxy)) return null;   // dataset missing -> no trade

  // Rolling history of dxy (~30 days)
  if (ctx.state.dxyHist == null) ctx.state.dxyHist = [];
  ctx.state.dxyHist.push(dxy);
  if (ctx.state.dxyHist.length > 30) ctx.state.dxyHist.shift();
  const dxyPrev = ctx.state.dxyHist[0];   // ~30 days ago

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2.5;
    const dollarTurn = dxyPrev != null && dxy > dxyPrev;   // dollar strengthening -> exit
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < sma200 || dollarTurn) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' }]);
    return null;
  }

  const dollarWeak = dxyPrev != null && dxy < dxyPrev;   // dollar falling over ~30 days
  if (prevClose > sma200 && dollarWeak) {
    const qty = (ctx.cash * 0.95 / price) * 0.95;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'regime long',
                 conds: [{ label: 'dollar weakening', ok: dollarWeak, closed: true }] }]);
    return { side: 'buy', qty };
  }
  return null;
}
