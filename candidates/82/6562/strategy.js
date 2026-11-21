/*
 * @coinsori-strategy v1
 * name: BTC VIX-Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC's long up-trends tend to happen when markets are calm (low volatility),
 * and break down when a risk-off spike in volatility hits. VIX is a daily measure of stock-market
 * fear that leads crypto risk appetite. This strategy rides BTC's trend but only when VIX is calm,
 * so it sidesteps the worst drawdowns that come with volatility spikes.
 * When it buys and sells: Buy BTC with the whole account when the last closed 4h close is above a
 * RISING 200-bar SMA AND VIX is calm (below a risk-off level). Sell everything when the close falls
 * below the SMA, or when VIX stays in a risk-off zone for two consecutive daily readings (a single
 * one-day blip is ignored). A volatility stop closes any position that drops 3x the 14-bar ATR from entry.
 * When it does NOT work: In a long flat range the price crosses the SMA and each crossing costs fees
 * (whipsaw). VIX is daily and lags by 2 days, so a sudden crypto-only crash that does not move VIX yet
 * will not be caught early. If VIX stays calm through a slow BTC bear grind, this behaves like a plain
 * trend follower and gives back gains. It is long-only, so it misses short-side profit in bear markets.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  if (sma == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // ---- VIX regime filter (cross-asset macro) ----
  // VIX is daily with a 2-day lag. Below 25 = calm (risk-on), above 30 = clear risk-off panic.
  // The gap between them is the asymmetry: we enter only when calm, exit only on a real panic, so a
  // single-day blip in between does not churn us out of a running uptrend. Null = unknown -> fall back
  // to trend-only rather than block trading on missing data.
  const vix = ctx.data('base.vix');
  const vixCalm = vix == null ? true : vix < 25;
  // Count how many consecutive daily readings have been above the panic level (stored across ticks).
  const st = ctx.state;
  const vixPanic = vix != null && vix > 30;
  const panicStreak = vixPanic ? (st.panicStreak || 0) + 1 : 0;
  st.panicStreak = panicStreak;
  // Need 2 consecutive panic readings before we treat it as a real risk-off regime (filters noise).
  const riskOff = panicStreak >= 2;

  const band = 0.02; // 2% hysteresis so small noise around the SMA does not churn the position
  const pos = ctx.position || 0;

  // volatility-based hard stop: 3x the 14-bar ATR from entry, only fires in genuine fast crashes
  if (pos > 0 && ctx.entryPx != null) {
    const atr = ctx.atr(14, 1);
    if (atr != null) {
      const stop = ctx.entryPx - 3 * atr;
      if (prevClose < stop) {
        ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR hard stop' }]);
        return { side: 'sell', qty: pos, reduceOnly: true };
      }
    }
  }

  if (pos > 0) {
    // exit on trend break OR on a sustained VIX panic — either one means the edge is gone
    ctx.watch([
      { side: 'sell', price: sma * (1 - band), trigger: 'below', note: 'SMA200 -2% exit' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'VIX panic exit', conds: [{ label: 'VIX panic 2d', ok: riskOff }] }
    ]);
    if (prevClose < sma * (1 - band) || riskOff) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // flat: only buy when trend is clearly up AND SMA is still rising AND VIX is calm
  const smaPrev = ctx.sma(200, 5);
  if (smaPrev == null) return null;
  const rising = sma > smaPrev;

  ctx.watch([{ side: 'buy', price: sma * (1 + band), trigger: 'above', note: 'SMA200 +2% go long', conds: [{ label: 'VIX calm', ok: vixCalm }] }]);
  if (rising && vixCalm && prevClose > sma * (1 + band)) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
