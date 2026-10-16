/*
 * @coinsori-strategy v1
 * name: MultiAsset Trend EMA50/200 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the validated EMA50/200 trend core (4h basket:
 * +285/+112/+57 on three disjoint windows) moved to the slower 1d timeframe.
 * A 50/200 EMA cross on daily bars is a much rarer, higher-conviction signal
 * than on 4h bars, which should cut the whipsaw in choppy ranges — the core's
 * stated weakness — while still riding the same multi-year trends. The basket
 * of 4 liquid coins keeps a single asset's crash from sinking the account.
 * When it buys and sells: on each asset, buy when the 50-day EMA crosses above
 * the 200-day EMA, or re-enter while flat when the trend is intact (EMA50>
 * EMA200 and price above the 400-day average). Sell on a death cross or when
 * price falls 2.5 ATR below entry. Re-entry waits 24 bars (24 days) after an
 * exit.
 * When it does NOT work: the 200-day EMA needs ~1 year of history to warm up,
 * so it misses the first leg of a new bull market; and it is long-only, so a
 * sustained multi-year bear across all coins is flat-to-loss.
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
  if (!st.cool) st.cool = {};

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry - 2.5 * atr : price - 2.5 * atr;
    if (f <= s) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    if (price <= stopPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop 2.5 ATR from entry' }]);
    return null;
  }

  const lastExit = st.cool[sym];
  if (lastExit != null && ctx.i - lastExit < 24) return null;

  let enter = false;
  if (fp <= sp && f > s) enter = true;
  else if (f > s && price > sma400) enter = true;
  if (!enter) return null;

  const riskCash = ctx.cash * 0.01;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
