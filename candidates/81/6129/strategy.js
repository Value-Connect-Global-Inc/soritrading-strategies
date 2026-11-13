/*
 * @coinsori-strategy v1
 * name: BTC Perp Funding Contrarian 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Perpetual funding is a sentiment gauge — very positive funding means a crowded long that tends to unwind, very negative funding means a crowded short that tends to squeeze. We fade the crowded side, but only in the direction of the slow trend so we do not fight the market.
 * When it buys and sells: Long only when funding is clearly negative (crowded shorts) AND price is above the 200-bar SMA AND RSI is pulling back below 45. Short only when funding is clearly positive (crowded longs) AND price is below the 200-bar SMA AND RSI is bouncing above 55. Exits when the trend filter flips or funding normalizes, plus a hard 2.5xATR stop on every position.
 * When it does NOT work: In strong one-way trends funding stays extreme and the contrarian fade loses; in choppy sideways markets it whipsaws on both sides. Shorting crypto during a relentless bull run is the worst case.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const sma = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  const funding = ctx.funding;
  const pos = ctx.position || 0;

  if (sma == null || rsi == null || atr == null || funding == null) {
    ctx.watch([]);
    return null;
  }

  const longStop = pos > 0 && ctx.entryPx != null ? ctx.entryPx - atr * 2.5 : null;
  const shortStop = pos < 0 && ctx.entryPx != null ? ctx.entryPx + atr * 2.5 : null;

  ctx.watch([
    { side:'buy', price: sma, trigger:'above', note:'long: uptrend + crowded short', conds:[ { label:'funding', now:funding, op:'<=', ref:-0.00025, closed:true }, { label:'RSI(14)', now:rsi, op:'<', ref:45, closed:true } ] },
    { side:'sell', price: sma, trigger:'below', note:'long exit: trend broke' },
    { side:'sell', price: longStop, trigger:'below', note:'long hard stop' },
    { side:'sell', price: sma, trigger:'below', note:'short: downtrend + crowded long', conds:[ { label:'funding', now:funding, op:'>=', ref:0.0004, closed:true }, { label:'RSI(14)', now:rsi, op:'>', ref:55, closed:true } ] },
    { side:'buy', price: sma, trigger:'above', note:'short exit: trend flipped' },
    { side:'buy', price: shortStop, trigger:'above', note:'short hard stop' }
  ]);

  // qty = 90% of cash as notional (~1x leverage) — conservative for a perp that can short
  const qty = ctx.cash / price * 0.9;

  if (pos === 0) {
    // funding <= -0.00025 (shorts paying >0.025%/8h = crowded short) in an uptrend with a pullback
    if (funding <= -0.00025 && price > sma && rsi < 45) {
      return { side: 'buy', qty: qty };
    }
    // funding >= 0.0004 (longs paying >0.04%/8h = crowded long) in a downtrend with a bounce
    if (funding >= 0.0004 && price < sma && rsi > 55) {
      return { side: 'sell', qty: qty };
    }
    return null;
  }

  if (pos > 0) {
    if (price < sma || funding >= 0 || (longStop != null && price <= longStop)) {
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }

  if (pos < 0) {
    if (price > sma || funding <= 0 || (shortStop != null && price >= shortStop)) {
      return { side: 'buy', qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }
  return null;
}
