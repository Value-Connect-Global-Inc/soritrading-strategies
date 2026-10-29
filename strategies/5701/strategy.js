/*
 * @coinsori-strategy v1
 * name: BTC Dollar-Regime Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A weakening US dollar tends to lift risk assets, and crypto most of all.
 * Riding BTC's uptrend only while the broad dollar index is falling filters out rallies that
 * happen against a strengthening dollar (which historically fade).
 * When it buys and sells: Buys when BTC closes above its 200-day average AND the dollar index is
 * below its own 50-day average (dollar weakening). Sells when BTC closes below its 200-day average,
 * the dollar index rises back above its 50-day average, or price falls 20% below entry.
 * When it does NOT work: In a crypto bull that runs while the dollar is also strong (correlated
 * risk-on), it stays in cash and misses the move. The 20% stop is the real protection in crashes.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const usd = ctx.data("base_usd_broad"); // Fed broad dollar index, DTWEXBGS (same series as dxy)
  if (sma200 == null || usd == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Rolling 50-day average of the dollar index, kept in restart-safe state.
  const hist = (ctx.state.usdHist || []).concat(usd).slice(-50);
  ctx.state.usdHist = hist;
  if (hist.length < 50) return null;
  const usdSma50 = hist.reduce((a, b) => a + b, 0) / hist.length;
  const dollarWeak = usd < usdSma50;

  if (ctx.position > 0) {
    const stop = (ctx.entryPx != null) ? ctx.entryPx * 0.8 : null; // 20% disaster stop
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: stop, trigger: 'below', note: '20% stop' },
      { side: 'sell', price: null, note: 'Dollar strengthening', conds: [{ label: 'USD above own 50d', ok: !dollarWeak, closed: true }] }
    ]);
    if (prevClose < sma200) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (!dollarWeak) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 uptrend', conds: [{ label: 'Dollar weak', ok: dollarWeak, closed: true }] }
  ]);
  if (dollarWeak && prevClose > sma200) {
    // 60% of cash per entry; 20% stop limits account risk to ~12%
    const qty = (0.6 * ctx.cash) / ctx.price * 0.99;
    return { side: 'buy', qty: qty };
  }
  return null;
}
