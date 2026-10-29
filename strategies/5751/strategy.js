/*
 * @coinsori-strategy v1
 * name: BTC Yield-Curve Regime Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto is a liquidity/risk asset. When the US yield curve inverts
 * (10Y minus 2Y turns negative) markets are pricing a recession, and risk assets tend to
 * fall or chop. So this strategy only holds Bitcoin when the curve is healthy (risk-on)
 * AND price is above its long-term average. It uses the FRED 10Y-2Y spread (2-day lag),
 * a signal price alone cannot see.
 * When it buys and sells: Buys when price closes above the 200-day average AND the
 * 10Y-2Y spread is positive. Sells when price closes below the 100-day average OR the
 * spread turns negative (curve inversion = risk-off). Sized by vol-target (3% daily ATR = full).
 * When it does NOT work: In a bull market where the curve stays healthy the strategy just
 * rides the trend and lags buy-and-hold on sharp V-recoveries. The 2-day lag on the
 * yield data means the inversion exit fires about 2 days late. In a flat range it whipsaws.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const atr20 = ctx.atr(20, 1);
  const sma200 = ctx.sma(200, 1);
  const sma100 = ctx.sma(100, 1);
  const spread = ctx.data("base_t10y2y"); // 10Y minus 2Y, %p, 2-day lag
  if (atr20 == null || sma200 == null || sma100 == null || closes.length < 210) return null;
  if (spread == null) return null; // no yield data yet -> stay out, never treat unknown as risk-on

  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  const riskOn = spread > 0;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma100, trigger: 'below', note: 'close<100d avg' },
      { side: 'sell', note: 'curve inverts (10Y-2Y<0)', conds: [{ label: '10Y-2Y spread', now: spread, op: '<', ref: 0, closed: true }] }
    ]);
    if (prevClose < sma100 || !riskOn) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'close>200d avg' },
    { side: 'buy', note: 'curve healthy (10Y-2Y>0)', conds: [{ label: '10Y-2Y spread', now: spread, op: '>', ref: 0, closed: true }] }
  ]);

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > sma200 && riskOn) {
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct); // vol-target: 3% daily ATR = full position
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
