/*
 * @coinsori-strategy v1
 * name: Dollar-Weak Trend Follower
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto tends to rally when the US dollar weakens and to
 *   stall when the dollar strengthens, because BTC is priced in dollars and
 *   dollar weakness boosts risk assets. We only take long positions when the
 *   dollar is below its own 60-day average (weak-dollar regime) AND price is
 *   above its 50-day EMA (uptrend intact).
 * When it buys and sells: buy BTC when price is above the 50-day EMA and the
 *   Fed trade-weighted dollar index is below its 60-day average. Sell when the
 *   close drops below the 50-day EMA or a 2.5x ATR hard stop hits.
 * When it does NOT work: in a strong-dollar regime (dollar above its mean) it
 *   stays in cash and misses crypto rallies; a crypto rally can also happen
 *   while the dollar is flat. The 50-day EMA exit gives back part of every
 *   move. It is long-only, so it earns nothing in a dollar-driven bear.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const dxy = ctx.data('dxy');
  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (dxy == null || ema50 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Rolling 60-day mean of the dollar index stored in state
  const hist = ctx.state.dxyHist || [];
  hist.push(dxy);
  if (hist.length > 60) hist.shift();
  ctx.state.dxyHist = hist;
  if (hist.length < 60) return null;   // need a full 60-day window before trading
  const dxyMean60 = hist.reduce((a, b) => a + b, 0) / hist.length;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (prevClose < ema50) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: '50-day trend break' }]);
    return null;
  }

  const weakDollar = dxy < dxyMean60;  // dollar weakening = crypto risk-on
  const uptrend = prevClose > ema50;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'uptrend + weak dollar',
               conds: [{ label: 'DXY < 60-day mean', ok: weakDollar, closed: true },
                       { label: 'close > 50-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend) return null;
  if (!weakDollar) return null;

  const riskCash = ctx.cash * 0.02;    // risk 2% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
