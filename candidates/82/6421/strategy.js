/*
 * @coinsori-strategy v1
 * name: BTC Trend + VIX Risk-Off 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC trends for months but crashes violently when risk
 * appetite evaporates. The CBOE VIX measures stock-market fear; when it spikes
 * (risk-off), crypto usually sells off too, even if the trend is intact. This
 * rides the BTC uptrend (price above its 200-day average) but steps fully aside
 * while VIX is elevated, so the worst crash days are mostly missed.
 * When it buys and sells: buys when price closes above the 200-day SMA and VIX
 * is calm (below 28); sells when price closes below the SMA, or immediately when
 * VIX rises above 28 (risk-off escape), or on a 25% hard stop.
 * When it does NOT work: if a crypto crash happens without a VIX spike (e.g. a
 * crypto-specific event like an exchange collapse), the VIX filter gives no
 * warning and the hard stop is the only protection; in a slow grind-up with
 * elevated VIX it stays flat and buy-and-hold beats it.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);        // closed-bar trend line
  const vix = ctx.data('base_vix');      // CBOE VIX, 2-day lag, no look-ahead
  if (sma200 == null || vix == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;
  const st = ctx.state;

  const VIX_RISKOFF = 28;     // VIX above this = risk-off; 28 is a standard fear threshold
  const STOP_PCT = 0.75;      // hard stop: sell if price falls 25% below entry

  // ---- while holding: exits ----
  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : price;
    const watchList = [
      { side: 'sell', price: sma200, trigger: 'below', note: 'Trend death cross' },
      { side: 'sell', price: entry * STOP_PCT, trigger: 'below', note: 'Hard stop -25%' },
      { side: 'sell', price: VIX_RISKOFF, trigger: 'above', note: 'VIX risk-off (>=28)' },
    ];
    ctx.watch(watchList);

    if (price < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= entry * STOP_PCT) return { side: 'sell', qty: pos, reduceOnly: true };
    if (vix >= VIX_RISKOFF) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // ---- flat: enter only in calm uptrend ----
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Trend up + VIX calm' }]);
  if (price > sma200 && vix < VIX_RISKOFF) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  }
  return null;
}
