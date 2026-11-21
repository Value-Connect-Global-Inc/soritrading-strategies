/*
 * @coinsori-strategy v1
 * name: ETH VIX-Regime Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH's long up-trends, like BTC's, happen when markets are calm, and break down
 * when a risk-off volatility spike hits. VIX is a daily stock-market fear gauge that leads crypto
 * risk appetite. This rides ETH's trend but only when VIX is calm, sidestepping the worst drawdowns.
 * ETH is more volatile than BTC, so in calm up-trends it can rally harder — the same regime gate on a
 * bigger beta asset.
 * When it buys and sells: Buy ETH with the whole account when the last closed 4h close is above a
 * RISING 200-bar SMA AND VIX is calm (below 25). Sell everything when the close falls below the SMA,
 * or when VIX stays above 30 for two consecutive daily readings (a single blip is ignored). A 3x ATR
 * stop closes any position that drops that far from entry.
 * When it does NOT work: In a long flat range the price crosses the SMA and each crossing costs fees.
 * VIX is daily and lags by 2 days, so a sudden crypto-only crash that has not moved VIX yet is not
 * caught early. ETH falls harder than BTC in a crash, so the 3x ATR stop does more work. Long-only:
 * it misses short-side profit in bear markets.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  if (sma == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // VIX regime filter (daily, 2-day lag). Below 25 = calm, above 30 = panic. The gap gives
  // hysteresis: enter only when calm, exit only on a real panic, so a blip in between does not churn.
  const vix = ctx.data('base.vix');
  const vixCalm = vix == null ? true : vix < 25;
  const st = ctx.state;
  const vixPanic = vix != null && vix > 30;
  const panicStreak = vixPanic ? (st.panicStreak || 0) + 1 : 0;
  st.panicStreak = panicStreak;
  const riskOff = panicStreak >= 2;

  const band = 0.02; // 2% hysteresis so small noise around the SMA does not churn the position
  const pos = ctx.position || 0;

  // volatility hard stop: 3x the 14-bar ATR from entry
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
    ctx.watch([
      { side: 'sell', price: sma * (1 - band), trigger: 'below', note: 'SMA200 -2% exit' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'VIX panic exit', conds: [{ label: 'VIX panic 2d', ok: riskOff }] }
    ]);
    if (prevClose < sma * (1 - band) || riskOff) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const smaPrev = ctx.sma(200, 5);
  if (smaPrev == null) return null;
  const rising = sma > smaPrev;

  ctx.watch([{ side: 'buy', price: sma * (1 + band), trigger: 'above', note: 'SMA200 +2% go long', conds: [{ label: 'VIX calm', ok: vixCalm }] }]);
  if (rising && vixCalm && prevClose > sma * (1 + band)) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
