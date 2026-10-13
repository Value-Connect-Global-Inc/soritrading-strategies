/*
 * @coinsori-strategy v1
 * name: OnChainTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin network fundamentals (active addresses, hash rate) lead price — when
 * network usage and mining power are both expanding while price holds above its long-term trend,
 * the market is in a healthy long-term uptrend worth riding.
 * When it buys and sells: Buys when price is above the 200-day EMA AND 30-day average active
 * addresses are above their own 30-day filter AND hash rate is above its 30-day filter. Sells when
 * price falls back below the 200-day EMA (trend broken) or an 8% hard stop hits.
 * When it does NOT work: In choppy sideways markets with no clear trend it can whipsaw; in a sharp
 * crash the 8% stop limits damage but the trend exit lags. Long-only, so a sustained bear market
 * (price below 200-day EMA) means no trades at all.
 */
function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;
  // 30-day smoothed on-chain values, aligned to the daily bar
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  if (addr == null || addrSma == null || hr == null || hrSma == null) return null;

  const price = ctx.price;
  const trendUp = price > ema200;
  const networkUp = addr > addrSma;
  const miningUp = hr > hrSma;

  if (ctx.position === 0) {
    ctx.watch([{
      side: 'buy',
      price: ema200,
      trigger: 'above',
      note: 'trend + onchain growth',
      conds: [
        { label: 'addr > 30d avg', ok: networkUp },
        { label: 'hashrate > 30d avg', ok: miningUp }
      ]
    }]);
    if (trendUp && networkUp && miningUp) {
      const qty = (ctx.cash / price) * 0.98;
      return { side: 'buy', qty };
    }
  } else {
    const stopPx = (ctx.entryPx || price) * 0.92; // 8% hard stop on every position
    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: 'trend exit' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '8% stop' }
    ]);
    if (price < ema200 || price < stopPx) {
      return { side: 'sell', qty: ctx.position };
    }
  }
  return null;
}
