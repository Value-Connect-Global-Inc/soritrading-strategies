/*
 * @coinsori-strategy v1
 * name: BTC Dollar-Headwind Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A surging US dollar tightens global liquidity and has historically been a headwind for crypto. This strategy rides BTC's 200-bar uptrend but steps out early when the dollar rises well above its own recent norm, cutting drawdowns before price itself breaks the trend.
 * When it buys and sells: buys when the previous bar closes above the 200-bar average and the dollar is not surging; sells when the previous bar closes below the 200-bar average, or immediately when the dollar z-score exceeds +1.5, or on a 3x ATR stop below the entry.
 * When it does NOT work: when the dollar and BTC rise together (a crypto-specific rally while the dollar also strengthens), the gate exits too early and misses part of the move. Also when USD data is missing the gate is off.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // Rolling USD history in state -> z-score vs its own recent norm (not a fixed level).
  const usd = ctx.data('base_usd_broad');
  const hist = ctx.state.usdHist || [];
  if (usd != null) {
    hist.push(usd);
    if (hist.length > 120) hist.shift();
    ctx.state.usdHist = hist;
  }
  let usdZ = 0;
  if (hist.length >= 60 && usd != null) {
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length);
    if (sd > 0) usdZ = (usd - mean) / sd;
  }
  const dollarSurge = usdZ > 1.5; // dollar >1.5 std above its own norm = liquidity headwind

  const enterLvl = sma200 * 1.01;
  const exitLvl = sma200 * 0.99;

  if (ctx.position <= 0) {
    ctx.watch([{
      side: 'buy', price: enterLvl, trigger: 'above', note: 'above SMA200',
      conds: [{ label: 'USD z-score', now: Math.round(usdZ * 100) / 100, op: '<=', ref: 1.5 }]
    }]);
    if (prevClose > enterLvl && !dollarSurge) {
      return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.98 };
    }
    return null;
  }

  const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
  ctx.watch([
    { side: 'sell', price: exitLvl, trigger: 'below', note: 'below SMA200' },
    { side: 'sell', price: ctx.price, trigger: 'below', note: 'USD surge exit',
      conds: [{ label: 'USD z-score', now: Math.round(usdZ * 100) / 100, op: '>', ref: 1.5 }] },
    ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: '3xATR stop' }] : [])
  ]);
  if (prevClose < exitLvl || dollarSurge || (stop != null && ctx.price <= stop)) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
