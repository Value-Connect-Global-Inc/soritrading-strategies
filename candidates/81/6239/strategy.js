/*
 * @coinsori-strategy v1
 * name: Rates-Gated Defensive MR Basket 5-Asset 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The 5-asset defensive mean-reversion basket is the validated champion.
 * This version adds a RATES regime filter that the champion does not have: it skips dip-buys
 * when the US yield curve is deeply inverted (10Y minus 2Y well below zero). Deep inversion is
 * a credit-stress signal — in those periods crypto dips tend not to recover, so buying them
 * loses. Keeping the proven dip-buy recipe and only removing the worst regime should cut the
 * drawdown that hurt the champion in bear windows.
 * When it buys and sells: on each asset, buy when price closes below the lower Bollinger (20,2.5)
 * or below the ATR-adaptive low (EMA20 - 2.5*ATR) with RSI < 32, only inside a rising 200-day
 * average AND when the yield curve is not deeply inverted (10Y-2Y > -0.3). Sell via an ATR
 * trailing stop (2.5 ATR below the highest close since entry) or when price closes back above
 * the 20-day EMA.
 * When it does NOT work: in a broad coordinated crypto bear the rising-trend gate keeps it flat
 * (safe, little upside); a single straight-line melt-up of one asset lags buy-and-hold of that
 * asset. The yield filter is a slow daily macro signal, so it cannot protect against a fast
 * crypto-only crash that happens while the curve is still normal.
 */
function onUpdate(ctx) {
  // Per-symbol state (ctx.state is shared across the whole basket).
  ctx.state.peak = ctx.state.peak || {};

  const pos = ctx.position || 0;
  const sym = ctx.sym;

  // ---- indicators on CLOSED bars only (identical in backtest and live) ----
  const ema200 = ctx.ema(200, 1);
  const ema200prev = ctx.ema(200, 2);
  const ema20 = ctx.ema(20, 1);
  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2.5, 1);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || ema200prev == null || ema20 == null || rsi == null || bb == null || atr == null) {
    ctx.watch([]);
    return null;
  }

  const close = ctx.closes.at(-2);           // last CLOSED bar close
  const trendUp = ema200 > ema200prev;
  const keltnerLow = ema20 - 2.5 * atr;

  // ---- rates regime gate (daily macro, lag-aware: base_t10y2y is a closed daily value) ----
  const t10y2y = ctx.data('base_t10y2y');
  const ratesOk = t10y2y == null ? true : t10y2y > -0.3; // -0.3 = deeply inverted, skip dip buys

  // ---- exits ----
  if (pos > 0) {
    const peak = ctx.state.peak[sym] || close;
    ctx.state.peak[sym] = Math.max(peak, close);
    const trail = ctx.state.peak[sym] - 2.5 * atr;   // ATR trail: 2.5x daily range is wide enough to survive noise
    const snapBack = close > ema20;
    if (snapBack || close < trail) {
      ctx.watch([{ side: 'sell', price: snapBack ? ema20 : trail, trigger: snapBack ? 'above' : 'below', note: 'MR exit (EMA20 or ATR trail)' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: trail, trigger: 'below', note: 'ATR trail' }]);
    return null;
  }

  // ---- entries ----
  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }
  if (!trendUp || !ratesOk) { ctx.watch([]); return null; }

  const dip = close < bb.lower || close < keltnerLow;
  if (dip && rsi < 32) {
    const qty = (ctx.alloc ? ctx.alloc.current : ctx.cash) * 0.98 / ctx.price;
    ctx.watch([{
      side: 'buy',
      price: Math.min(bb.lower, keltnerLow),
      trigger: 'below',
      note: 'MR dip entry',
      conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 32, closed: true },
        { label: 'EMA200 rising', ok: trendUp },
        { label: '10Y-2Y not inverted', ok: ratesOk }
      ]
    }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
