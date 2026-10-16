/*
 * @coinsori-strategy v1
 * name: SentGated Trend EMA50/200 4H Basket
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the EMA50/200 trend core is the one family with repeated
 * out-of-sample evidence in this environment (4-coin basket +285/+112/+57% on
 * three disjoint 4h windows). Its residual cost is the late entry: a trend
 * strategy buys on a bullish cross that often happens near a local top, and
 * the 2.5-ATR stop then takes the pullback. This version adds a sentiment
 * gate from a different family — the Crypto Fear & Greed Index. When the
 * crowd is at EXTREME greed (>= 80), a fresh trend buy is most likely a
 * blow-off-top late entry, so we skip opening new longs until the index
 * cools. Positions already held are never touched by the gate.
 * When it buys and sells: on each asset, buy when the 50-period EMA crosses
 * above the 200-period EMA (or re-enter while the trend is intact and price
 * is above the 400-period average) AND the Fear & Greed index is below 80.
 * Sell on a death cross or when price falls 2.5 ATR below the entry price.
 * Re-entry waits 24 bars (4 days) after an exit.
 * When it does NOT work: in a long choppy sideways range the crossovers
 * whipsaw and the stops turn small dips into realized losses; long-only
 * means a sustained bear market is flat-to-loss. The F&G gate also skips
 * legitimately strong trends that happen to start at extreme greed, so it
 * sacrifices some upside in exchange for avoiding late blow-off entries.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Closed-bar EMAs so signals are identical in backtest, paper and live.
  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const fp = ctx.ema(50, 2), sp = ctx.ema(200, 2);
  const sma400 = ctx.sma(400, 1);
  const atr = ctx.atr(14, 1);
  if (f == null || s == null || fp == null || sp == null || sma400 == null || atr == null) return null;

  const fg = Number(ctx.data('fg'));
  const fgKnown = Number.isFinite(fg);

  const sym = ctx.sym;
  const st = ctx.state || {};
  if (!st.cool) st.cool = {}; // per-symbol cooldown bar index after an exit

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    // Fixed stop from entry, as in the validated core — a trailing stop gets
    // stopped out on pullbacks inside an intact trend and churns fees.
    const stopPx = entry != null ? entry - 2.5 * atr : price - 2.5 * atr;
    if (f <= s) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; } // death cross -> trend over
    if (price <= stopPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop 2.5 ATR from entry' }]);
    return null;
  }

  // Cooldown: wait 24 bars (4 days) after an exit before re-entering this asset.
  const lastExit = st.cool[sym];
  if (lastExit != null && ctx.i - lastExit < 24) return null;

  // Entry: fresh bullish cross, OR re-entry while the trend is intact — but NOT
  // when the crowd is at extreme greed. F&G >= 80 = blow-off-top zone; a new
  // long there is a late entry whose first move is usually a pullback.
  let enter = false;
  if (fp <= sp && f > s) enter = true;
  else if (f > s && price > sma400) enter = true;
  if (!enter) return null;
  if (fgKnown && fg >= 80) return null;

  // Size: risk 1% of cash on the 2.5-ATR stop distance, capped so a wide-stop
  // trade cannot ruin the account. 1% per asset across 4 assets.
  const riskCash = ctx.cash * 0.01;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
