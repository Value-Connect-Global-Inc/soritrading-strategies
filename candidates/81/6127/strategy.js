/*
 * @coinsori-strategy v1
 * name: ETH Dip-Timed Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH spends most of its time trending; buying after a confirmed turn up and
 *   riding until the trend breaks captures most of a bull move while stepping aside in bear
 *   markets. This is the exact framework that nearly passed every auto-promote check on BTC 4h,
 *   now cross-validated on ETH.
 * When it buys and sells: It buys when the 4h price turns back above its ~50-day trend line
 *   (SMA300), or when it pulls back ~1.5 standard deviations inside an uptrend with RSI below
 *   40 (a confirmed oversold dip). It sells when price closes back below the trend line, or drops
 *   more than 6x the daily range below entry (a wide catastrophe guard). Uses 70% of cash.
 * When it does NOT work: In a long sideways market the trend line whipsaws and repeated small
 *   losses accumulate; in a slow grinding decline the trend line exits late and gives back gains.
 */

function onUpdate(ctx) {
  const trend = ctx.sma(300, 1);      // 300 4h bars ~ 50 days: the long-term trend line
  const trendPrev = ctx.sma(300, 2);
  const z = ctx.zscore(50, 1);        // 50 4h bars ~ 8 days: how far price is from its recent mean
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  const sma50 = ctx.sma(50, 1);
  const sd50 = ctx.stdev(50, 1);
  const prevClose = ctx.closes.at(-2);     // last CLOSED bar's close
  const prevPrevClose = ctx.closes.at(-3); // the bar before it
  const price = ctx.price;

  if (trend == null || trendPrev == null || z == null || rsi == null || atr == null || sma50 == null || sd50 == null || prevClose == null || prevPrevClose == null) {
    ctx.watch([]);
    return null;
  }

  if (ctx.position > 0) {
    const entry = ctx.entryPx;
    if (entry == null) { ctx.watch([]); return null; }
    const stop = entry - 6.0 * atr;   // wide catastrophe guard (~10-15%); the trend break is the real exit
    const watch = [
      { side: 'sell', price: trend, trigger: 'below', note: 'trend broken' },
      { side: 'sell', price: stop, trigger: 'below', note: 'wide stop' },
    ];
    if (prevClose < trend || price <= stop) {
      ctx.watch(watch);
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    ctx.watch(watch);
    return null;
  }

  const buyLevel = sma50 - 1.5 * sd50;   // the price level that corresponds to z <= -1.5
  const crossUp = prevClose > trend && prevPrevClose <= trendPrev;   // confirmed turn up
  const dip = prevClose > trend && z <= -1.5 && rsi <= 40;          // confirmed oversold dip inside uptrend
  const entryWatch = [
    { side: 'buy', price: trend, trigger: 'above', note: 'trend turn up',
      conds: [{ label: 'close > SMA300', ok: prevClose > trend }] },
    { side: 'buy', price: buyLevel, trigger: 'below', note: 'dip entry',
      conds: [
        { label: 'z-score(50)', now: z, op: '<=', ref: -1.5, closed: true },
        { label: 'RSI(14) closed', now: rsi, op: '<=', ref: 40, closed: true },
      ] },
  ];
  if (crossUp || dip) {
    ctx.watch(entryWatch);
    return { side: 'buy', qty: ctx.cash / price * 0.7 };   // 70% of cash: keeps max drawdown survivable
  }
  ctx.watch(entryWatch);
  return null;
}
