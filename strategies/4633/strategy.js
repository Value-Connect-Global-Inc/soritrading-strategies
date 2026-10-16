/*
 * @coinsori-strategy v1
 * name: Fed Easing Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Monetary policy drives risk appetite. When the Fed is
 * cutting rates, liquidity flows into risk assets like BTC and rallies tend to
 * persist; when the Fed is hiking, liquidity drains and rallies die. We ride BTC
 * only while policy is easing AND the long-term trend is up.
 * When it buys and sells: buy when the last closed bar is above the 200-day EMA
 * and the federal funds rate is below its value 30 days earlier (easing).
 * Sell when the price closes below the 200-day EMA, the rate turns back up
 * (tightening), or a 15% hard stop is hit.
 * When it does NOT work: it stays out during tightening even if BTC rallies on
 * other drivers (e.g. 2023-2024 crypto bull ran while rates were still high), and
 * a rate cut alone does not save a falling market — the trend filter does that.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 2) return null;
  const prevClose = c.at(-2);

  const fed = ctx.data('fed');            // effective fed funds rate now
  const fedLag = ctx.data('fed_lag30');   // same rate 30 days ago
  const easing = fed == null || fedLag == null ? null : fed < fedLag;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;   // hard stop 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (easing === false) return { side: 'sell', qty: pos };     // policy turning restrictive
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: 'Fed easing', ok: easing !== false, closed: true }] }]);
    return null;
  }

  // policy easing is the core gate; without data we cannot confirm it
  if (easing == null || easing === false) return null;
  const uptrend = prevClose > ema200;
  if (!uptrend) return null;

  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'Fed easing (rate < 30d ago)', ok: easing, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.02 / atrPct);   // wild coin smaller, calm coin bigger
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
