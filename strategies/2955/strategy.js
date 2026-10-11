/*
 * @coinsori-strategy v1
 * name: BTC 1D Defensive Dip-Buy + Trend Sleeve
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC trends up over years but with violent drawdowns. The
 * proven edge is buying deep oversold flushes below the lower Bollinger band
 * while the 200-day average is still rising — buy fear at a discount, sit in
 * cash otherwise. The weakness of that approach is it misses straight-line
 * melt-ups (no dip to buy). This version keeps the defensive dip-buying core
 * UNCHANGED and adds a small "trend sleeve": when in a strong uptrend with no
 * dip, it holds a partial position so it still participates in a melt-up.
 * When it buys and sells: Defensive core — full-cash buy when price is below the
 * lower Bollinger band and RSI is oversold (below 30, or below 40 in a confirmed
 * strong bull) while price sits above a rising 200-day average; exit on snap-back
 * or a 10-day-low trailing stop. Trend sleeve — when no dip is available but the
 * 200-day average is clearly rising and price is far above it, hold a small
 * partial position that rides until the short trend breaks.
 * When it does NOT work: In a long sideways chop with no dip and no sustained
 * uptrend it stays mostly in cash (fine, low drawdown, but no return). In a
 * violent bear it dodges losses by staying in cash but the trend sleeve can
 * take small hits before the 200-day turns down. It still lags buy-and-hold in
 * relentless melt-ups because the sleeve is deliberately small.
 * 2026-01-20: added ctx.watch declarations only — display only, trading logic unchanged.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  if (sma200 == null || sma200prev == null || bb == null || rsi == null) return null;

  const uptrend = sma200 > sma200prev;
  // Strong trend = price well above the rising 200-day line -> let winners ride.
  const strongTrend = price > sma200 * 1.08;
  const st = ctx.state;

  // ---- Trend sleeve sizing: how much of the melt-up we want to ride ----
  // Deliberately small (40% of cash) so the sleeve cannot wreck the low
  // drawdown that makes the defensive core attractive.
  const sleeveQty = (ctx.cash / price) * 0.40;

  if (pos > 0) {
    const inDefensive = st.mode === 'def';
    if (inDefensive) {
      const low10 = ctx.low(10, 1);
      if (strongTrend) {
        if (low10 != null && price < low10) {
          ctx.watch([
            { side: 'sell', price: low10, trigger: 'below', qty: pos, note: 'defensive 10d low stop' }
          ]);
          st.cd = ctx.i + 3;
          return { side: 'sell', qty: pos };
        }
        ctx.watch([
          { side: 'sell', price: low10, trigger: 'below', qty: pos, note: 'defensive 10d low stop' },
          { side: 'sell', price: bb.mid, trigger: 'above', qty: pos, note: 'snap-back exit' },
          { side: 'sell', price: 60, trigger: 'above', qty: pos, note: 'RSI exit', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }] }
        ]);
        return null;
      }
      if (price > bb.mid || rsi > 60) {
        ctx.watch([
          { side: 'sell', price: bb.mid, trigger: 'above', qty: pos, note: 'snap-back exit' },
          { side: 'sell', price: 60, trigger: 'above', qty: pos, note: 'RSI exit', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }] }
        ]);
        st.cd = ctx.i + 3;
        return { side: 'sell', qty: pos };
      }
      ctx.watch([
        { side: 'sell', price: low10, trigger: 'below', qty: pos, note: 'defensive 10d low stop' },
        { side: 'sell', price: bb.mid, trigger: 'above', qty: pos, note: 'snap-back exit' },
        { side: 'sell', price: 60, trigger: 'above', qty: pos, note: 'RSI exit', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }] }
      ]);
      return null;
    }
    // ---- Trend sleeve exit: short trend breaks ----
    const ema20 = ctx.ema(20, 1);
    const ema50 = ctx.ema(50, 1);
    if (ema20 == null || ema50 == null) return null;
    // Exit the sleeve when the 20-day average crosses back below the 50-day:
    // the short uptrend that justified the sleeve is gone.
    if (ema20 < ema50) {
      ctx.watch([
        { side: 'sell', price: ema50, trigger: 'below', qty: pos, note: 'sleeve EMA20<EMA50 exit', conds: [{ label: 'EMA20 close', now: ema20, op: '<', ref: ema50, closed: true }] }
      ]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([
      { side: 'sell', price: ema50, trigger: 'below', qty: pos, note: 'sleeve EMA20<EMA50 exit', conds: [{ label: 'EMA20 close', now: ema20, op: '<', ref: ema50, closed: true }] }
    ]);
    return null;
  }

  if (st.cd != null && ctx.i < st.cd) {
    ctx.watch([]);
    return null;
  }

  // ---- Defensive core entry (unchanged): oversold flush in a rising uptrend ----
  const rsiBar = strongTrend ? 40 : 30;
  if (uptrend && price < bb.lower && rsi < rsiBar) {
    ctx.watch([
      { side: 'buy', price: bb.lower, trigger: 'below', qty: (ctx.cash / price) * 0.95, note: 'defensive dip buy', conds: [
        { label: 'SMA200 rising', ok: uptrend },
        { label: 'RSI(14) close', now: rsi, op: '<', ref: rsiBar, closed: true }
      ] }
    ]);
    st.cd = null;
    st.mode = 'def';
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  // ---- Trend sleeve entry: no dip, but a strong rising trend -> ride a piece ----
  // Only when the 200-day is clearly rising AND price is far above it. This is
  // the melt-up regime the defensive core would otherwise sit out.
  const ema20 = ctx.ema(20, 1);
  const ema50 = ctx.ema(50, 1);
  if (uptrend && strongTrend && ema20 != null && ema50 != null && ema20 > ema50) {
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', qty: sleeveQty, note: 'trend sleeve entry', conds: [
        { label: 'SMA200 rising', ok: uptrend },
        { label: 'Price > 1.08*SMA200', ok: strongTrend },
        { label: 'EMA20>EMA50 close', now: ema20, op: '>', ref: ema50, closed: true }
      ] }
    ]);
    st.mode = 'sleeve';
    return { side: 'buy', qty: sleeveQty };
  }

  // ---- No entry condition: show what we're waiting for ----
  const conditions = [];
  if (!uptrend) {
    conditions.push({ label: 'SMA200 rising', ok: uptrend });
  }
  if (!strongTrend) {
    conditions.push({ label: 'Price > 1.08*SMA200', ok: strongTrend });
  }
  if (price >= bb.lower) {
    conditions.push({ label: 'Price < BB lower', ok: price < bb.lower });
  }
  if (rsi >= rsiBar) {
    conditions.push({ label: 'RSI(14) < ' + rsiBar, now: rsi, op: '<', ref: rsiBar, closed: true });
  }
  if (ema20 != null && ema50 != null && !(ema20 > ema50)) {
    conditions.push({ label: 'EMA20 > EMA50', now: ema20, op: '>', ref: ema50, closed: true });
  }
  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'defensive dip buy', conds: conditions.slice(0, 4) },
    { side: 'buy', price: sma200, trigger: 'above', note: 'trend sleeve entry', conds: conditions.slice(0, 4) }
  ]);
  return null;
}
