/*
 * @coinsori-strategy v1
 * name: ETH Panic-Entry Trend-Exit 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index marks panic-selling lows (index <= 25) that are
 * historically good entry points when they happen inside an uptrend. The exit is managed by TREND and by
 * a TRAILING STOP, not by the index: selling only when the trend turns or price gives back a fixed
 * multiple of ATR from its highest point lets the strategy ride sustained rallies instead of taking
 * profit too early in a melt-up. A trend-start entry (50-bar average crossing above the 200-bar average)
 * is added so the strategy also joins every sustained rally and does not sit out a melt-up.
 * When it buys and sells: it buys ETH when the 50-bar average crosses above the 200-bar average (trend
 * start) OR when the Fear & Greed index is 25 or below inside a confirmed uptrend (panic dip). It sells
 * when the 50-bar average crosses below the 200-bar average, the close falls below the 200-bar average,
 * price drops 3xATR below entry, or the close falls 2.5xATR below the highest close since entry (trailing
 * stop that lets winners run).
 * When it does NOT work: in a slow grinding bear market the uptrend filters keep it flat (safe but
 * useless), and in a range-bound market with no sustained trend it gets crossed in and out repeatedly,
 * paying fees on both sides. A long-only strategy still misses the biggest melt-ups relative to holding
 * because it is not fully invested at all times.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;

  const sma200 = ctx.sma(200, 1);
  const ema50_1 = ctx.ema(50, 1);
  const ema200_1 = ctx.ema(200, 1);
  const ema50_2 = ctx.ema(50, 2);
  const ema200_2 = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || ema50_1 == null || ema200_1 == null || ema50_2 == null || ema200_2 == null || atr == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const fg = ctx.data('fear_greed');

  if (pos > 0) {
    const entry = ctx.entryPx;
    // Hard stop 3xATR below entry: backstop for the first bars before the trail tightens.
    const stopPx = (entry != null) ? entry - 3 * atr : price * 0.85;
    // Trailing stop: protect the highest close since entry, not the entry price. 2.5xATR is mid-range
    // (2-3): tight enough to keep gains in a turn, loose enough to survive normal pullbacks in a trend.
    let hi = ctx.state.highest;
    if (hi == null || prevClose > hi) { hi = prevClose; ctx.state.highest = prevClose; }
    const trailPx = hi - 2.5 * atr;
    ctx.watch([
      { side: 'sell', price: ema200_1, trigger: 'below', note: 'EMA50<EMA200 exit' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '3xATR stop' },
      { side: 'sell', price: trailPx, trigger: 'below', note: 'Trail 2.5xATR' }
    ]);
    if (ema50_1 < ema200_1) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose <= trailPx) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // Position is flat: clear the trailing-stop high so a new entry starts from its own high.
  ctx.state.highest = null;

  // Entry A: trend start — EMA50 crosses above EMA200 on closed bars.
  const trendUp = ema50_1 > ema200_1 && ema50_2 <= ema200_2 && prevClose > sma200;
  // Entry B: panic dip inside a confirmed uptrend (sentiment entry).
  const panicDip = fg != null && fg <= 25 && prevClose > sma200 && ema50_1 > ema200_1;

  if (trendUp || panicDip) {
    // Trend-strength-scaled risk: in a strong trend the trend-cross exit (not the ATR stop) is the real
    // risk control, so a bigger budget is justified; in a weak trend stay conservative at 30%.
    const strength = (ema50_1 / ema200_1) - 1; // e.g. 0.05 = EMA50 is 5% above EMA200
    const riskBudget = 0.30 + 0.30 * Math.min(1, Math.max(0, strength) / 0.10); // 30%..60%
    let qty = ctx.cash / price * 0.99;
    qty = Math.min(qty, (ctx.cash * riskBudget) / (3 * atr));
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'Trend start',
        conds: [{ label: 'EMA50>EMA200', ok: ema50_1 > ema200_1 }] },
      { side: 'buy', price: sma200, trigger: 'above', note: 'Panic dip in uptrend',
        conds: [{ label: 'Fear&Greed', now: fg, op: '<=', ref: 25, closed: true }] }
    ]);
    return { side: 'buy', qty };
  }
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'Trend start',
      conds: [{ label: 'EMA50>EMA200', ok: ema50_1 > ema200_1 }] },
    { side: 'buy', price: sma200, trigger: 'above', note: 'Panic dip in uptrend',
      conds: [{ label: 'Fear&Greed', now: fg, op: '<=', ref: 25, closed: true }] }
  ]);
  return null;
}
