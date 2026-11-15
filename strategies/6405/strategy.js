/*
 * @coinsori-strategy v1
 * name: BTC Donchian Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Classic turtle trend following — a break above the 20-bar high in a
 * strengthening uptrend (200-bar average rising) starts a trend, and a wide 55-bar Donchian
 * low exit (fast entry / slow exit) lets winners run through normal pullbacks instead of
 * being stopped out early.
 * When it buys and sells: buys when the last closed bar closes above the 20-bar Donchian high
 * while the 200-bar SMA is rising; sells when a closed bar closes below the 55-bar Donchian low.
 * When it does NOT work: long, choppy sideways markets where breakout fakes stop out
 * repeatedly, and any sustained bear market (it only buys in an uptrend).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const cash = ctx.cash;
  const pos = ctx.position;

  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 2);
  if (sma200 == null || sma200Prev == null) {
    ctx.watch([]);
    return null;
  }

  const dcHigh20 = donchianHigh(ctx, 20, 2);
  const dcLow55 = donchianLow(ctx, 55, 2);
  const prevClose = ctx.closes.at(-2);
  // Regime filter: only buy while the long average itself is rising (strengthening trend).
  const trendUp = sma200 > sma200Prev;

  if (pos <= 0) {
    ctx.watch([{ side: 'buy', price: dcHigh20, trigger: 'above', note: 'DC20 breakout', conds: [{ label: 'SMA200 rising', ok: trendUp }] }]);
    if (prevClose > dcHigh20 && trendUp) {
      const qty = cash / price * 0.98;
      return { side: 'buy', qty };
    }
    return null;
  }

  // Wide 55-bar exit = ~9 days, keeps the trend alive through normal pullbacks.
  ctx.watch([{ side: 'sell', price: dcLow55, trigger: 'below', note: 'DC55 exit' }]);

  if (prevClose < dcLow55) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  return null;
}

function donchianHigh(ctx, n, ago) {
  const highs = ctx.highs;
  const end = highs.length - 1 - ago;
  let m = -Infinity;
  for (let i = end - n + 1; i <= end; i++) m = Math.max(m, highs[i]);
  return m;
}
function donchianLow(ctx, n, ago) {
  const lows = ctx.lows;
  const end = lows.length - 1 - ago;
  let m = Infinity;
  for (let i = end - n + 1; i <= end; i++) m = Math.min(m, lows[i]);
  return m;
}
