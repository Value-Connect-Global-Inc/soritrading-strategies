/*
 * @coinsori-strategy v1
 * name: VIX Gate + Chandelier Trail 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends hard in risk-on phases but crashes violently when
 * volatility spikes. A chandelier trailing stop (highest high since entry minus 3xATR)
 * rides long trends without stepping out on small pullbacks, while a VIX z-score gate
 * keeps the strategy out of panic regimes.
 * When it buys and sells: buys when the 4h close is above its 200-bar EMA and the VIX
 * z-score (vs its own 60-day history) is below +1.0. Sells when price falls below the
 * trailing stop, or below the EMA on two consecutive closes, or the VIX z-score exceeds
 * +2.0 (panic), or a hard 10% stop below entry.
 * When it does NOT work: in a choppy sideways market the EMA and chandelier whipsaw and
 * fees accumulate; and if VIX data is unavailable it falls back to trend-only (still
 * long-biased, so a long bear market still hurts).
 */
function onUpdate(ctx) {
  const TREND_N = 200;    // 200 x 4h bars = ~33 days of trend
  const ATR_N = 14;
  const TRAIL_K = 3.0;    // chandelier stop distance in ATR multiples (standard 3)
  const VIX_Z_ENTRY = 1.0;
  const VIX_Z_EXIT = 2.0;
  const STOP = 0.10;      // hard stop below entry
  const WINDOW = 60;      // VIX rolling window in daily observations

  const ema = ctx.ema(TREND_N, 1);
  const atr = ctx.atr(ATR_N, 1);
  const prevClose = ctx.closes.at(-2);
  const prevHigh = ctx.highs.at(-2);
  if (ema == null || atr == null || prevClose == null || prevHigh == null) {
    ctx.watch([]);
    return null;
  }

  // --- VIX regime: rolling z-score over unique daily values, kept in ctx.state ---
  const vix = ctx.data('base_vix');
  let vixZ = null;
  let hist = (ctx.state && Array.isArray(ctx.state.vixHist)) ? ctx.state.vixHist : [];
  if (vix != null) {
    if (hist.length === 0 || Math.abs(hist[hist.length - 1] - vix) > 1e-9) {
      hist.push(vix);
      if (hist.length > WINDOW) hist = hist.slice(-WINDOW);
      ctx.state.vixHist = hist;
    }
    if (hist.length >= 20) {
      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length);
      if (sd > 1e-9) vixZ = (vix - mean) / sd;
    }
  }
  const riskOff = vixZ != null && vixZ > VIX_Z_EXIT;
  const calmEnough = vixZ == null || vixZ < VIX_Z_ENTRY;

  const holding = ctx.position > 1e-9;
  const uptrend = prevClose > ema;

  // --- chandelier trailing state (survives restarts via ctx.state) ---
  let hh = (ctx.state && ctx.state.hh) || 0;
  if (holding && prevHigh > hh) { hh = prevHigh; ctx.state.hh = hh; }
  const chandelier = hh - TRAIL_K * atr;

  // --- EMA trend-break exit needs TWO consecutive closes below the EMA (kills whipsaw) ---
  const ema2 = ctx.ema(TREND_N, 2);
  const prevClose2 = ctx.closes.at(-3);
  const emaBreak = ema2 != null && prevClose2 != null && prevClose2 < ema2 && prevClose < ema;

  // --- rule 6: declare every entry/exit price every tick ---
  if (holding) {
    const w = [
      { side: 'sell', price: chandelier, trigger: 'below', note: 'chandelier stop' },
      { side: 'sell', price: ema, trigger: 'below', note: 'trend break' }
    ];
    if (ctx.entryPx != null) {
      w.push({ side: 'sell', price: ctx.entryPx * (1 - STOP), trigger: 'below', note: 'hard stop' });
    }
    ctx.watch(w);
  } else {
    ctx.watch([{ side: 'buy', price: ema, trigger: 'above', note: 'trend up', conds: [{ label: 'VIX calm', ok: calmEnough }] }]);
  }

  // --- exits (reduce-only, sized from ctx.position) ---
  if (holding) {
    if (ctx.price <= chandelier || emaBreak || riskOff) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    if (ctx.entryPx != null && ctx.price <= ctx.entryPx * (1 - STOP)) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  // --- entry ---
  if (uptrend && calmEnough) {
    ctx.state.hh = prevHigh;   // start the trailing stop from the entry bar's high
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
