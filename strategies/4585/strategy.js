/*
 * @coinsori-strategy v1
 * name: FearGreed Regime Basket v7 TrailingStop
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index is a crowd-sentiment gauge
 * and momentum persists in crypto: when the crowd is greedy (index >= 55)
 * prices keep climbing, and when the crowd turns fearful (index <= 40) the
 * trend has broken. This rides confirmed sentiment on a 4-coin basket. v7
 * replaces the fixed -25% stop with a 20% TRAILING stop from the highest
 * close reached since entry, so in a strong uptrend the stop rises with the
 * price and locks in gains instead of only capping a loss.
 * When it buys and sells: on each asset, buy when Fear & Greed >= 55 AND
 * price is above its 200-day average AND the Fed is not hiking. Sell when
 * price falls 20% below the best close since entry (trailing stop), or the
 * sentiment index falls to <= 40.
 * When it does NOT work: in a steep fast crash price can gap through the
 * trailing stop, and in a choppy market repeated 20% retracements cause
 * exits and re-entries. It still misses the very start of a bull because it
 * waits for confirmed greed, and the Fear & Greed index lags price.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // ctx.data returns strings — coerce to number.
  const fg = Number(ctx.data('fg'));
  if (!Number.isFinite(fg)) return null;

  const pos = ctx.position;
  if (pos > 0) {
    // Track the highest close since entry in persistent state. On the entry
    // bar (state.peak missing) seed it with the current price.
    const peak = (ctx.state && ctx.state.peak) ? ctx.state.peak : price;
    const newPeak = Math.max(peak, price);
    ctx.state = { peak: newPeak };

    // 20% trailing stop from the best close since entry: locks in gains as
    // the trend rises, and cuts the position when the uptrend retraces.
    if (price <= newPeak * 0.8) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: newPeak * 0.8, trigger: 'below', note: 'trail: -20%' }]);

    if (fg <= 40) return { side: 'sell', qty: pos }; // greed over -> exit
    return null;
  }

  // Flat: reset the trailing peak for the next entry.
  ctx.state = { peak: null };

  // Trend filter: only enter when price is above its 200-day average (closed
  // bar). The F&G index lags price in a fast crash — this avoids buying into
  // a downtrend that the index has not yet registered.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // Fed liquidity filter: only buy while the Fed is NOT hiking — current fed
  // funds rate above its 30-day-ago value = tightening = hostile for a
  // zero-yield risk asset. Missing data = not hiking (permissive).
  const fed = Number(ctx.data('fed'));
  const fedLag = Number(ctx.data('fed_lag30'));
  const fedHiking = Number.isFinite(fed) && Number.isFinite(fedLag) && fed > fedLag;

  if (fg >= 55 && price > sma200 && !fedHiking) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  // Declare what we are waiting for so the run card shows it.
  ctx.watch([{
    side: 'buy',
    price: fg >= 55 ? sma200 : price,
    trigger: 'above',
    note: 'enter: greed>=55 & trend up & fed ok',
    conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 55, closed: true },
           { label: 'Fed not hiking', ok: !fedHiking }]
  }]);
  return null;
}
