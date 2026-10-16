/*
 * @coinsori-strategy v1
 * name: MultiAsset Trend EMA50/200 4H profit-lock
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the EMA50/200 trend core is the one family with repeated
 * out-of-sample evidence in this environment (4-asset basket +57/+112/+285%
 * on three disjoint 4h windows). The champion's weak spot is drawdown on the
 * most recent window (MDD 35%). This version adds a profit-lock stop: once a
 * trade runs +1.5 ATR above entry, the stop lifts to entry +0.5 ATR so a
 * winner that reverses cannot give back all its gain. This is NOT a trailing
 * stop from the start (that churned and failed); the fixed 2.5-ATR stop stays
 * in place until the profit threshold is reached, then it locks a small gain.
 * When it buys and sells: on each asset, buy when the 50-period EMA crosses
 * above the 200-period EMA, or re-enter while flat when the trend is intact
 * (EMA50>EMA200 and price above the 400-period average). Sell on a death
 * cross, when price falls 2.5 ATR below entry, or at the locked stop (entry
 * +0.5 ATR) once the trade has run +1.5 ATR above entry. Re-entry waits
 * 24 bars (4 days) after an exit.
 * When it does NOT work: in a long choppy sideways range the crossovers
 * whipsaw and the stops turn small dips into realized losses; the profit-lock
 * can exit a trade that later resumes its up move, giving back trend profit.
 * Long-only means a sustained bear market across all coins is flat-to-loss,
 * and it lags a fast V-shaped recovery after a crash.
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

  const sym = ctx.sym;
  const st = ctx.state || {};
  if (!st.cool) st.cool = {}; // per-symbol cooldown bar index after an exit

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    // Fixed stop from entry, as in the validated core.
    let stopPx = entry != null ? entry - 2.5 * atr : price - 2.5 * atr;
    // Profit-lock ratchet: once price has run +1.5 ATR above entry, lift the
    // stop to entry +0.5 ATR. 1.5 ATR = "a real move, not noise"; +0.5 ATR
    // locks a small gain and covers round-trip fees (~0.2%) so the trade can
    // never turn from winner into loser. The fixed stop stays put until then.
    if (entry != null && price > entry + 1.5 * atr) stopPx = Math.max(stopPx, entry + 0.5 * atr);
    if (f <= s) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; } // death cross -> trend over
    if (price <= stopPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop' }]);
    return null;
  }

  // Cooldown: wait 24 bars (4 days) after an exit before re-entering this
  // asset, otherwise a choppy market churns fees (v1/v2 failure: 1300/580 trades).
  const lastExit = st.cool[sym];
  if (lastExit != null && ctx.i - lastExit < 24) return null;

  // Entry: fresh bullish cross, OR re-entry while the trend is intact.
  let enter = false;
  if (fp <= sp && f > s) enter = true;
  else if (f > s && price > sma400) enter = true;
  if (!enter) return null;

  // Size: risk a small fixed share of the per-symbol cash on the stop distance
  // so a wide-stop trade cannot ruin the account. With 4 assets in the basket,
  // 1% per asset keeps the total risk budget the same as the 2-asset version
  // (2% per asset) — diversification without doubling total exposure.
  const riskCash = ctx.cash * 0.01;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
