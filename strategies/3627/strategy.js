/*
 * @coinsori-strategy v1
 * name: ETH On-Chain Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: sustained crypto rallies are driven by real network use,
 *   and a rising count of active Bitcoin addresses is a leading signal that
 *   usage is expanding. When on-chain activity is growing, trend breakouts
 *   are more likely to continue; when it is shrinking, breakouts tend to fail.
 * When it buys and sells: buy a 20-bar high close above the 100-EMA only when
 *   active addresses are above their 30-day average. Sell on a 20-bar low
 *   close, a 2.5x ATR hard stop, or a close back below the 100-EMA.
 * When it does NOT work: on-chain growth lags price in fast speculative pumps
 *   (gaps the strategy out of early moves) and can stay high for a while after
 *   price already topped, letting late entries ride into the reversal.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const addr = ctx.data('addr');            // active addresses (raw)
  const addrAvg = ctx.data('addr_sma30');   // 30-day average of active addresses
  const onChainOk = addr != null && addrAvg != null && addr > addrAvg;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    if (prevClose < ema100) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA trend break' }]);
    return null;
  }

  if (!onChainOk) return null;   // on-chain gate: only buy while network usage is growing
  if (prevClose <= ema100) return null;
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;
  const volPrev = ctx.volPrev;
  const avgVol = ctx.avgVol(20);
  if (volPrev == null || avgVol == null || avgVol <= 0) return null;
  if (volPrev < avgVol) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
