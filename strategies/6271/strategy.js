/*
 * @coinsori-strategy v1
 * name: VIX Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin drawdowns cluster in global risk-off episodes that
 * show up as spikes in US equity volatility (VIX), and in crypto-only crashes
 * that show up as spikes in BTC's own ATR. Regime gate on VIX keeps the long
 * side out of equity risk-off; ATR volatility targeting shrinks the position
 * when BTC itself becomes violent.
 * When it buys and sells: it buys when the 4h close is 3% above its 200-bar
 * average AND the VIX z-score (vs its own trailing mean) is below +1.0; the
 * position is sized by risk budget / 5xATR stop distance (capped at full cash)
 * so volatile periods trade smaller. It sells when the close falls 3% below the
 * average, or price drops 5xATR below the best high since entry, or VIX z-score
 * jumps above +1.2 (forced risk-off exit).
 * When it does NOT work: in a sideways chop inside the band it stays flat and
 * misses short swings, and it lags fast moves because both the 200-bar average
 * and the daily VIX series are slow.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const vix = ctx.data('base_vix');

  // Rolling VIX z-score from distinct observations (dedupe consecutive repeats).
  const hist = ctx.state.vixHist || [];
  if (vix != null && vix > 0) {
    const last = hist[hist.length - 1];
    if (last == null || Math.abs(last - vix) > 1e-9) {
      hist.push(vix);
      if (hist.length > 120) hist.shift(); // ~6 months of daily obs
      ctx.state.vixHist = hist;
    }
  }
  const n = hist.length;
  let vixZ = null;
  if (n >= 30) {
    const mean = hist.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n) || 1;
    vixZ = (vix - mean) / sd;
  }
  // Unknown vol = assume calm so missing data never blocks entries.
  const calm = vixZ == null || vixZ < 1.0;
  const hotExit = vixZ != null && vixZ > 1.2;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  if (pos > 0) {
    const atrNow = ctx.atr(14, 1);
    const hh = ctx.state.hh != null ? Math.max(ctx.state.hh, price) : price;
    ctx.state.hh = hh;
    // 5xATR chandelier: tighter than the original 6x to cut drawdown on sharp reversals.
    const chand = atrNow != null ? hh - 5 * atrNow : price * 0.9;
    const exitPx = Math.max(sma200 * 0.97, chand);
    if (hotExit) {
      ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'VIX panic exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: exitPx, trigger: 'below', note: 'Trend/chandelier exit' }]);
    if (prevClose <= exitPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.closes.length < 220) { ctx.watch([]); return null; }
  if (prevClose > sma200 * 1.03 && calm) {
    ctx.state.hh = price;
    const atrNow = ctx.atr(14, 1);
    // Volatility targeting: risk 8% of equity over the 5xATR stop distance, capped at full cash.
    let qty = ctx.cash / price * 0.99;
    if (atrNow != null && atrNow > 0) {
      qty = Math.min(qty, (ctx.cash * 0.08) / (5 * atrNow));
    }
    ctx.watch([{ side: 'buy', price: sma200 * 1.03, trigger: 'above', note: 'Regime up + VIX calm' }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma200 * 1.03, trigger: 'above', note: 'Regime up + VIX calm' }]);
  return null;
}
