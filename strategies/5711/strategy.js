/*
 * @coinsori-strategy v1
 * name: BTC Golden-Cross Regime Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The pure 200-day moving-average trend (strategy 5710) is
 * this job's best result, but it whipsaws when price hovers just above the
 * SMA200 line in a sideways or still-falling market. Adding one regime filter —
 * the faster 50-day average must also sit above the 200-day average — means we
 * only buy when the short and long trends AGREE, i.e. a confirmed uptrend, not
 * a dead-cat bounce across the line.
 * When it buys and sells: Buys when the previous close is above the 200-day
 * average AND the 50-day average is above the 200-day average. Sells when the
 * close falls back below the 200-day average. No other exits.
 * When it does NOT work: In a long sideways range it still whipsaws across the
 * 200-day line (the golden regime turns on/off with it). It lags sharp
 * V-shaped recoveries from deep bears because the 50-day average needs time to
 * climb back above the 200-day. It is fully invested in a bull, so a sudden
 * crash below the average gives back the full drawdown before the exit triggers.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  if (sma200 == null || sma50 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const golden = sma50 > sma200; // regime filter: fast trend agrees with slow trend
  const pos = ctx.position;

  ctx.watch([
    {
      side: 'buy', price: sma200, trigger: 'above', note: 'close above SMA200',
      conds: [{ label: 'SMA50>SMA200', ok: golden }]
    },
    { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200' }
  ]);

  if (pos > 0) {
    if (prevClose < sma200) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (prevClose > sma200 && golden) {
    const qty = (0.99 * ctx.cash) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
