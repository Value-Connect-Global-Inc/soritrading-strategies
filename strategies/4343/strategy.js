/*
 * @coinsori-strategy v1
 * name: ETH On-Chain Gated Breakout 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Breakouts are only worth riding when real network usage is
 *   growing. BTC's daily active addresses measure actual adoption (people using
 *   the network) - a fundamentally different axis from price. When active
 *   addresses sit above their 30-day average, a fresh 20-bar high close is more
 *   likely a genuine move than a false breakout.
 * When it buys and sells: buys on a fresh 20-bar high close above the 100-EMA
 *   with above-average volume, but only while BTC active addresses are above
 *   their 30-day average. Sells on a 20-bar low close, a 2.5x ATR hard stop, or
 *   a close back below the 100-EMA.
 * When it does NOT work: in choppy sideways years the 20-bar breakout whipsaws;
 *   when address counts are falling (network shrinking) it stays in cash even
 *   during price rallies; long-only means a sustained bear market is flat-to-loss.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // on-chain adoption gate: BTC active addresses above their 30-day average
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const adoptionOk = addr != null && addrSma != null && addr > addrSma;

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

  if (!adoptionOk) return null;   // on-chain gate: no entries while network usage shrinks
  if (prevClose <= ema100) return null;
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;  // need a fresh 20-bar high close
  const volPrev = ctx.volPrev;
  const avgVol = ctx.avgVol(20);
  if (volPrev == null || avgVol == null || avgVol <= 0) return null;
  if (volPrev < avgVol) return null;

  // risk-based sizing: risk 2% of cash on the 2.5x ATR stop, capped at full cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
