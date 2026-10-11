/*
 * @coinsori-strategy v1
 * name: Multi-Asset Momentum-Pullback 5-Asset 1D
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated MR family buys oversold CRASHES (Bollinger-low flushes).
 * This is a genuinely different bet: buy SHALLOW pullbacks inside a strong uptrend — the
 * "buy the dip in strength" pattern, where price is above a rising 200-day average and a
 * rising 50-day EMA but has dipped back to the 20-day EMA. It aims to capture the continued
 * trend after a healthy consolidation instead of waiting for a deep flush that may not come.
 * When it buys and sells: buy when price is in a confirmed uptrend (above rising 200-day SMA
 * and above rising 50-day EMA) and pulls back to touch the 20-day EMA with RSI in the 40-60
 * healthy range (a normal dip, not a crash). Sell on a 2.5-ATR trailing stop below the peak
 * or when price closes back below the 50-day EMA (trend broken).
 * When it does NOT work: in a chop/bear regime the "uptrend" gate whipsaws and the shallow
 * dip keeps falling (no support), so it buys falling knives without the deep-flush discount
 * that protects the MR family. Trend-following has repeatedly failed on crypto, so this may
 * lose in sideways markets and bleed on fees from frequent re-entries.
 *
 * 2026-02-12: 표시만 바뀜, 매매 판단은 그대로.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema50 = ctx.ema(50, 1);
  const ema50prev = ctx.ema(50, 2);
  const ema20 = ctx.ema(20, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma200prev == null || ema50 == null || ema50prev == null || ema20 == null || rsi == null || atr == null || atr <= 0) return null;

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    // 2.5 ATR trailing stop lets winners run but cuts a reversal; 50-EMA break = trend over.
    const trailingStop = peak - 2.5 * atr;
    if (price < trailingStop || price < ema50) {
      ctx.state.peak = null;
      ctx.state.cooldown = ctx.i;
      return { side: 'sell', qty: pos };
    }
    ctx.watch([
      { side: 'sell', price: trailingStop, trigger: 'below', note: 'trail stop 2.5 ATR', conds: [
        { label: 'EMA50', now: ema50, op: '>', ref: price, closed: true }
      ]},
      { side: 'sell', price: ema50, trigger: 'below', note: 'EMA50 break' }
    ]);
    return null;
  }

  if (ctx.state.cooldown != null && ctx.i - ctx.state.cooldown < 8) {
    ctx.watch([]);
    return null;
  }

  // Confirmed uptrend: price above a RISING 200-SMA and above a RISING 50-EMA.
  const uptrend = price > sma200 && sma200 > sma200prev && price > ema50 && ema50 > ema50prev;
  if (!uptrend) {
    ctx.watch([]);
    return null;
  }

  // Shallow healthy pullback: price dipped to the 20-EMA band with RSI 40-60 (a normal dip,
  // not a crash — this is the key difference from the oversold MR family).
  const nearEma20 = price <= ema20 * 1.02 && price >= ema20 * 0.97;
  const healthyDip = nearEma20 && rsi >= 40 && rsi <= 60;

  if (healthyDip) {
    const riskBudget = 0.025 * ctx.cash;
    let qty = riskBudget / atr;
    const maxQty = (ctx.cash / price) * 0.20; // never exceed the 20% leg share
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.state.peak = price;
    ctx.state.cooldown = null;
    ctx.watch([{ side: 'buy', price: ema20 * 1.02, trigger: 'below', note: '20-EMA touch', conds: [
      { label: 'RSI(14)', now: rsi, op: '>=', ref: 40, closed: true },
      { label: 'RSI(14)', now: rsi, op: '<=', ref: 60, closed: true },
      { label: 'SMA200 rising', ok: sma200 > sma200prev, closed: true },
      { label: 'EMA50 rising', ok: ema50 > ema50prev, closed: true }
    ]}]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
