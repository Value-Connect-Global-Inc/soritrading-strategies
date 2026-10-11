/*
 * @coinsori-strategy v1
 * name: 3-Asset Pullback Basket w/ Stop Cooldown 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Same validated pullback-in-uptrend edge as the basket
 *   (dip below EMA50 with RSI<40 in an EMA50>EMA200 uptrend, exit on return
 *   above EMA50 or 2x ATR stop). The one documented weakness of the family is
 *   bleeding in low-vol chop via repeated stop-outs; this variant adds a
 *   30-bar (5 day) cooldown on an asset AFTER a stop loss, so we do not
 *   immediately re-buy a falling knife. Normal entries are untouched.
 * When it buys and sells: per asset, buy the dip as above; sell when price
 *   closes back above that asset's EMA50 or on a 2x ATR stop from entry.
 *   After a stop-out, that asset is skipped for 30 bars.
 * When it does NOT work: a broad coordinated crypto bear keeps every leg flat
 *   (capital safe, little upside); if a dip bounces within the 5-day cooldown
 *   window, this variant misses that bounce.
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

  const st = ctx.state || {};
  const stops = st.stops || {};   // sym -> bar index of last stop-out

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const stopPx = ctx.entryPx - 2 * atr;
    if (price <= stopPx) {
      stops[sym] = ctx.i;         // remember the stop-out bar
      st.stops = stops;
      return { side: 'sell', qty: pos };
    }
    if (price > fp) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' }]);
    return null;
  }

  // cooldown: do not re-enter an asset for 30 bars (5 days) after a stop-out.
  // Pre-hoc reason: a stop means the dip is still falling; wait for a reset.
  if (stops[sym] != null && ctx.i - stops[sym] < 30) return null;

  if (f <= s) return null;
  if (price <= s) return null;
  if (rsi >= 40) return null;
  if (price >= f) return null;

  const riskCash = ctx.cash * 0.01;        // 1% of total equity risked per leg
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap each leg at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
