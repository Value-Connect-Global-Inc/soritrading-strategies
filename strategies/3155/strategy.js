/*
 * @coinsori-strategy v1
 * name: BTC Onchain Network Growth Trend 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's active-address 30-day average reflects real network usage. When network usage is growing AND price is above its 200-day average, BTC tends to keep trending up; when either flips, the trend is breaking.
 * When it buys and sells: Buys when network growth (addr_sma30 above its 90-day EMA) and price above 200-day SMA both hold. Sells when either condition fails.
 * When it does NOT work: A bear market where network usage stays high while price falls (usage lags price), or a bull market where price runs ahead of usage (early cycle). Expect drawdowns and missed rallies.
 *
 * 2026-04-27: 표시만 바뀜, 매매 판단은 그대로 (ctx.watch 선언만 추가)
 */
function onUpdate(ctx) {
  const addrSma = ctx.data('addr_sma30');
  if (addrSma == null) {
    ctx.watch([]); // network data unknown -> no wait condition
    return null;
  }

  // Running 90-day EMA of addr_sma30 stored in state (persists across bars).
  let ema = ctx.state.ema90;
  if (ema == null) {
    ema = addrSma;
  } else {
    const alpha = 2 / (90 + 1);
    ema = alpha * addrSma + (1 - alpha) * ema;
  }
  ctx.state.ema90 = ema;

  const price = ctx.price;
  const sma200 = ctx.sma(200, 1); // closed bars -> same in backtest/live
  if (sma200 == null) {
    ctx.watch([]); // not enough closed bars -> no wait condition
    return null;
  }

  const holding = ctx.position > 0;
  const networkOk = addrSma > ema;
  const trendOk = price > sma200;

  const watch = [];
  if (holding) {
    watch.push({ side: 'sell', price: sma200, trigger: 'below', note: 'price < SMA200' });
    watch.push({ side: 'sell', note: 'network growth fail', conds: [{ label: 'addr_sma30 <= EMA90', ok: !networkOk }] });
  } else {
    watch.push({ side: 'buy', price: sma200, trigger: 'above', note: 'price > SMA200', conds: [{ label: 'addr_sma30 > EMA90', ok: networkOk }] });
  }
  ctx.watch(watch);

  if (!holding && networkOk && trendOk) {
    return { side: 'buy', qty: ctx.cash / price * 0.99 };
  }
  if (holding && (!networkOk || !trendOk)) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
