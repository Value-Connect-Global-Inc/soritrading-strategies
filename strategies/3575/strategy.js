/*
 * @coinsori-strategy v1
 * name: 3-Asset Pullback Basket 4H DXY
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The pullback-in-uptrend edge is independently validated
 *   on each of BTC, ETH and BNB 4h. Running all three in one basket diversifies
 *   single-asset risk while keeping the same proven entry (dip below EMA50 with
 *   RSI<40 in an EMA50>EMA200 uptrend) and exit (return above EMA50 or 2x ATR
 *   stop). Each leg is capped at 30% of cash so a single stop loss can never
 *   ruin the account. NEW: a Dollar Index regime filter only lets entries fire
 *   when the dollar is weak (risk-on for crypto).
 * When it buys and sells: per asset, buy the dip as above; sell when price
 *   closes back above that asset's EMA50 or on a 2x ATR stop from entry.
 * When it does NOT work: a broad coordinated crypto bear keeps every leg flat
 *   (capital safe, little upside); a long low-vol chop regime bleeds via stops
 *   on whichever legs are active. The DXY filter can also block valid bull-run
 *   entries during a strong-dollar phase, cutting upside in a regime where
 *   crypto and dollar rise together.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const fp = ctx.ema(50, 2);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  if (f == null || s == null || fp == null || rsi == null || atr == null) return null;

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const stopPx = ctx.entryPx - 2 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };
    if (price > fp) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' }]);
    return null;
  }

  if (f <= s) return null;
  if (price <= s) return null;
  if (rsi >= 40) return null;
  if (price >= f) return null;

  // Macro regime filter: only buy dips when the Dollar Index is weak (risk-on).
  // 104 is roughly the long-term middle of DXY; if the series is unavailable (null) we don't block.
  // Reason: a rising dollar pressures risk assets, so dips in a strong-dollar
  // regime are more likely to be real crashes than pullbacks.
  const dxy = ctx.data('dxy');
  if (dxy != null && dxy >= 104) return null;

  const riskCash = ctx.cash * 0.01;        // 1% of total equity risked per leg
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap each leg at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
