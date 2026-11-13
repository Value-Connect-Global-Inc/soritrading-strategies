/*
 * @coinsori-strategy v1
 * name: BTC Trend + Dollar Gate 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Same trend core as the champion (EMA50/200 crossover + 3x ATR stop)
 * but gated by US DOLLAR strength instead of equities. Crypto is a dollar-liquidity asset:
 * when the broad US dollar index rallies hard, risk assets including BTC usually fall, no
 * matter what the BTC trend line says. This only takes BTC trend entries when the dollar is
 * not in a strong uptrend. The gate is entry-only — once in, trend/stop decide the exit.
 * When it buys and sells: buy when EMA50 crosses above EMA200 on BTC AND the broad dollar
 * is not more than ~0.5% above its own 90-day average (i.e. dollar not in a strong rally).
 * Sell when EMA50 crosses below EMA200, or the 3x ATR stop is hit.
 * When it does NOT work: in a crypto-specific rally while the dollar also strengthens, the
 * gate keeps it flat and it misses the move; the dollar series is daily with a long lag, so
 * it cannot react to fast intra-crypto crashes. In flat chop the EMA crossover whipsaws.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;

  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const ema50prev = ctx.ema(50, 2);
  const ema200prev = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || ema200 == null || ema50prev == null || ema200prev == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const close = ctx.closes.at(-2);

  // Dollar regime (entry only): broad USD index not >0.5% above its own 90-day mean.
  // Daily series; at 4h (6 bars/day) a true 90-day window is 540 pushed bars.
  const usd = ctx.data('base.usd_broad');
  const st = ctx.state;
  st.usdHist = st.usdHist || [];
  if (usd != null) {
    st.usdHist.push(usd);
    if (st.usdHist.length > 600) st.usdHist.shift();
  }
  let usdOk = true;
  if (st.usdHist.length >= 540) {
    const recent = st.usdHist.slice(-540);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    // 0.5% above mean = dollar in a strong rally -> risk-off, block entries
    usdOk = usd != null && usd <= mean * 1.005;
  }

  // ---- exits (trend + stop, no macro exit) ----
  if (pos > 0) {
    const trendDown = ema50prev >= ema200prev && ema50 < ema200;
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    if (trendDown || (stop != null && close < stop)) {
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: 'trend/stop exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '3x ATR stop' }]);
    return null;
  }

  // ---- entries ----
  const trendUp = ema50prev <= ema200prev && ema50 > ema200;
  if (trendUp && usdOk) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{
      side: 'buy',
      price: close,
      trigger: 'above',
      note: 'EMA50/200 cross up',
      conds: [{ label: 'USD not in strong rally', ok: usdOk }]
    }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
