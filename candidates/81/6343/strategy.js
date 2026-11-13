/*
 * @coinsori-strategy v1
 * name: BTC Long-Short Calm Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend-following on BTC perpetuals in BOTH directions, but
 * only entering when volatility is calm. Volatility explosions usually come
 * right before a trend breaks, so re-entering into a vol spike just buys the
 * whipsaw. Filtering for calm ATR cuts the chop that bleeds a plain long/short.
 * When it buys and sells: Long when the 50-bar average is above the 200-bar
 * average AND the ATR is below 1.2x its 60-bar median; short on the mirror.
 * Exit on the opposite flip or a 2.5xATR hard stop. Risk 2% of equity per trade.
 * When it does NOT work: In a long calm grind the filter keeps us out and we
 * miss the move; and perpetual funding (paid every 8h) drags on whichever side
 * the crowd is on, so a position held too long bleeds.
 */
function onUpdate(ctx) {
  const s = ctx.state;
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (sma50 == null || sma200 == null || atr == null) return null;

  // ATR-calm regime: current ATR below 1.2x its 60-bar rolling median
  if (!s.atrs) s.atrs = [];
  s.atrs.push(atr);
  if (s.atrs.length > 60) s.atrs.shift();
  let calm = true;
  if (s.atrs.length >= 30) {
    const sorted = s.atrs.slice().sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    calm = atr < med * 1.2; // only enter when volatility is not spiking
  }

  const pos = ctx.position;
  const up = sma50 > sma200;
  const down = sma50 < sma200;

  const stopDist = 2.5 * atr;
  let stopPx = null;
  if (ctx.entryPx != null) {
    stopPx = pos > 0 ? ctx.entryPx - stopDist : pos < 0 ? ctx.entryPx + stopDist : null;
  }

  if (pos > 0 && (down || (stopPx != null && ctx.price <= stopPx))) {
    ctx.watch([
      { side:'sell', price: sma200, trigger:'below', note:'trend flipped down' },
      { side:'sell', price: stopPx != null ? stopPx : sma200, trigger:'below', note:'ATR stop' }
    ]);
    return { side:'sell', qty: pos, reduceOnly:true };
  }
  if (pos < 0 && (up || (stopPx != null && ctx.price >= stopPx))) {
    ctx.watch([
      { side:'buy', price: sma200, trigger:'above', note:'trend flipped up' },
      { side:'buy', price: stopPx != null ? stopPx : sma200, trigger:'above', note:'ATR stop' }
    ]);
    return { side:'buy', qty: -pos, reduceOnly:true };
  }

  if (pos === 0 && calm) {
    if (up) {
      const qty = ctx.cash * 0.02 / stopDist;
      ctx.watch([{ side:'buy', price: sma200, trigger:'above', note:'calm uptrend entry' }]);
      return { side:'buy', qty: qty };
    }
    if (down) {
      const qty = ctx.cash * 0.02 / stopDist;
      ctx.watch([{ side:'sell', price: sma200, trigger:'below', note:'calm downtrend entry' }]);
      return { side:'sell', qty: qty };
    }
  }

  ctx.watch([]);
  return null;
}
