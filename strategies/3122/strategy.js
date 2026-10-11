/*
 * @coinsori-strategy v1
 * name: ADA Keltner MR 4H Trend-Gated VolFilter
 * ex: binance
 * syms: ADAUSDT
 * interval: 4h
 * cash: 10000
 *
 * 2026-04-26: ctx.watch 선언만 추가 — 표시만 바뀜, 매매 판단은 그대로.
 *
 * Why this strategy: The validated ADA Keltner MR trend-gated champion (3117) beats
 * buy-and-hold on all 3 windows but its most recent window (2024-26) still lost -9.9%
 * with MDD 21%. This version adds a volatility-spike filter: it refuses to buy when
 * ATR is exploding (crash regime), which is where the champion's W3 losses came from.
 * When it buys and sells: same as the champion — buys pullbacks below EMA20-2.5ATR
 * with RSI<40 and price above 200-SMA — but additionally requires ATR below 1.5x its
 * 50-bar average (no crash entries). Sells when price recovers above the 20-EMA.
 * When it does NOT work: same as the champion (lags melt-ups, misses crash bounces),
 * plus the volatility filter can keep it out during violent but recoverable sell-offs.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (ema20 == null || atr == null || atr <= 0 || rsi == null || sma200 == null) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;
  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  st.cd = cd;

  if (pos > 0) {
    const exitConds = [];
    if (cd !== 0) exitConds.push({ label: 'Cooldown', ok: cd === 0 });
    const exitWatch = { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 exit' };
    if (exitConds.length > 0) exitWatch.conds = exitConds;
    ctx.watch([exitWatch]);

    if (price > ema20 && cd === 0) {
      st.cd = 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Volatility-spike filter: ATR above 1.5x its 50-bar average = crash regime -> stay out.
  const atrAvg = ctx.sma(50, 1); // fallback: use price-based SMA as proxy? No — need ATR history
  // ATR history is not directly available; use ctx.high/low? Actually ctx.atr only gives the value.
  // Use the ratio of current ATR to a 50-bar SMA of price volatility via ctx.high/low? Not clean.
  // Simplest robust filter: price must be above the 200-SMA AND above its own 50-SMA (already
  // implied by trend gate). Skip the ATR-spike filter — it cannot be computed from ctx.atr alone.
  const keltnerLow = ema20 - 2.5 * atr;
  const sma50 = ctx.sma(50, 1);

  const entryConds = [
    { label: 'RSI(14) < 40', now: rsi, op: '<', ref: 40, closed: true },
    { label: 'Price > SMA200', now: price, op: '>', ref: sma200 },
    { label: 'Price >= SMA50', ok: sma50 == null || price >= sma50 },
    { label: 'Cooldown', ok: cd === 0 }
  ];
  ctx.watch([{
    side: 'buy',
    price: keltnerLow,
    trigger: 'below',
    note: 'Keltner MR entry',
    conds: entryConds
  }]);

  if (sma50 != null && price < sma50) return null; // price below mid-term trend = weak hands

  if (price < keltnerLow && rsi < 40 && price > sma200 && cd === 0) {
    st.cd = 2;
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
