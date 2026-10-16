/*
 * @coinsori-strategy v1
 * name: Onchain Regime Trend BTC
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin's on-chain network activity (unique active addresses) is a slow fundamental gauge of adoption. When addresses expand above their 30-day average, user demand is growing and trend-following longs tend to work; when they contract, the network is shedding users and risk is elevated.
 * When it buys and sells: Holds BTC only while price stays above its 100-period EMA AND active addresses stay above their 30-day average. Buys when both turn true while flat, sells when either breaks. A hard stop 3x ATR below entry caps any single loss.
 * When it does NOT work: In flat chop where price whips around the EMA it flips long/flat repeatedly and bleeds fees. It will not catch a rally that starts while addresses are still contracting, and the daily on-chain data reacts slowly on a 4h chart.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const ema = ctx.ema(100, 1);
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  if (ema == null || addr == null || addrSma == null) return null;

  const trendUp = price > ema;
  const networkExpanding = addr > addrSma; // adoption growing = demand tailwind for longs

  if (ctx.position > 0) {
    const atr = ctx.atr(14, 1);
    if (atr == null) return null;
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null; // hard stop 3x ATR caps single-trade loss
    ctx.watch([
      { side: 'sell', price: ema, trigger: 'below', note: 'trend broke EMA100' },
      { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' }
    ]);
    if (!trendUp) return { side: 'sell', qty: ctx.position };
    if (stop != null && price < stop) return { side: 'sell', qty: ctx.position };
    return null;
  }

  if (trendUp && networkExpanding) {
    ctx.watch([{ side: 'buy', price: ema, trigger: 'above', note: 'price over EMA100', conds: [{ label: 'addr>sma30', ok: networkExpanding }] }]);
    return { side: 'buy', qty: ctx.cash / price * 0.99 };
  }
  return null;
}
