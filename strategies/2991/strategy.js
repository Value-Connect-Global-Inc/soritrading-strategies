/*
 * @coinsori-strategy v1
 * name: BTC 1D Hybrid MR+Squeeze (Vol-Target Size)
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: This is my validated champion (Hybrid MR + Squeeze Breakout,
 * +144%/MDD26 on 2021-26 vs hold +43.8) with volatility-targeted position sizing.
 * The champion always buys ~98% of equity, so its 26% drawdown comes from full-size
 * positions in volatile regimes. Here I scale position size so every trade risks the
 * SAME dollar amount (4% of equity) measured to the 20-day-EMA stop — small size in
 * wild swings, larger in calm trends. This mild target keeps more of the champion's
 * upside than the 2% version while still trimming drawdown.
 * When it buys and sells: Same as champion — buy on a rising 200-day trend via
 * (a) a volume-confirmed Bollinger squeeze breakout above the 20-day high, or
 * (b) an RSI<40 pullback below the ATR-adaptive lower Keltner band. Sell when
 * price closes below the 20-day EMA or the 200-day trend turns down.
 * When it does NOT work: Vol-targeting caps upside in strong low-volatility bull
 * runs (smaller size than the champion would use). The rising-trend gate keeps us
 * flat in bears (capital-safe but little upside), and squeeze-downs are missed.
 * 
 * 2025-01-01: watch 선언만 추가 — 표시만 바뀜, 매매 판단은 그대로.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const high20 = ctx.high(20, 1);
  const bb = ctx.bb(20, 2, 1);
  if (ema20 == null || atr == null || rsi == null || sma200 == null || sma200prev == null ||
      high20 == null || bb == null || bb.upper == null || bb.lower == null || atr <= 0) return null;

  const pos = ctx.position;

  if (pos > 0) {
    // Exit below the 20-day EMA or when the long-term trend turns down (validated, untouched).
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'below', note: 'EMA20 exit', conds: [{ label: 'SMA200 uptrend', ok: sma200 >= sma200prev, closed: true }] },
      { side: 'sell', price: sma200prev, trigger: 'below', note: 'SMA200 downtrend', conds: [{ label: 'Price vs EMA20', now: price, op: '>', ref: ema20, closed: true }] }
    ]);
    if (price < ema20 || sma200 < sma200prev) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Only trade inside a rising long-term trend (the shared defensive gate).
  if (sma200 <= sma200prev) {
    ctx.watch([]);
    return null;
  }

  // Mean-reversion pullback entry: price under the ATR-adaptive lower Keltner band + weak RSI.
  const lowerBand = ema20 - 2.5 * atr;
  const mrEntry = price < lowerBand && rsi < 40;

  // Squeeze-breakout entry: Bollinger width in quietest 20% of last 100 bars + 20-day high break.
  const width = (bb.upper - bb.lower) / ((bb.upper + bb.lower) / 2);
  let pctile = 0.5;
  const lookback = 100;
  if (ctx.i >= lookback) {
    let countBelow = 0;
    let total = 0;
    for (let k = 1; k <= lookback; k++) {
      const b = ctx.bb(20, 2, k);
      if (b == null || b.upper == null || b.lower == null) continue;
      const w = (b.upper - b.lower) / ((b.upper + b.lower) / 2);
      total++;
      if (w > width) countBelow++;
    }
    if (total > 0) pctile = countBelow / total;
  }
  const squeezed = pctile <= 0.2 && price > high20 && width > 0;

  // Volume confirmation on the squeeze breakout (whipsaw-prone entry).
  const avgVol = ctx.avgVol(20);
  const volOk = avgVol != null && avgVol > 0 && ctx.vol > 1.2 * avgVol;
  const squeezeBreakout = squeezed && volOk;

  // Declare what we're waiting for (display only)
  const waitConds = [];
  if (mrEntry) {
    waitConds.push({ side: 'buy', price: lowerBand, trigger: 'below', note: 'MR pullback', conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'SMA200 uptrend', ok: sma200 > sma200prev, closed: true }
    ]});
  } else {
    waitConds.push({ side: 'buy', price: lowerBand, trigger: 'below', note: 'MR pullback', conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'SMA200 uptrend', ok: sma200 > sma200prev, closed: true }
    ]});
  }
  if (squeezeBreakout) {
    waitConds.push({ side: 'buy', price: high20, trigger: 'above', note: 'Squeeze breakout', conds: [
      { label: 'BB width pctile', now: pctile, op: '<=', ref: 0.2, closed: true },
      { label: 'Volume > 1.2x avg', ok: volOk, closed: true }
    ]});
  } else {
    waitConds.push({ side: 'buy', price: high20, trigger: 'above', note: 'Squeeze breakout', conds: [
      { label: 'BB width pctile', now: pctile, op: '<=', ref: 0.2, closed: true },
      { label: 'Volume > 1.2x avg', ok: volOk, closed: true }
    ]});
  }
  ctx.watch(waitConds);

  if (mrEntry || squeezeBreakout) {
    const equity = ctx.cash + ctx.uPnl;
    const base = (Number.isFinite(equity) && equity > 0 ? equity : ctx.cash);

    // Milder vol-target: risk 4% of equity to the EMA20 stop (test of the sizing sweet spot).
    const distPct = Math.max((price - ema20) / price, 0.02); // floor at 2% to avoid oversized bets
    const riskFrac = 0.04;
    const qty = (base * riskFrac) / (price * distPct);
    return { side: 'buy', qty: qty };
  }
  return null;
}
