/*
 * @coinsori-strategy v1
 * name: XRP ATR-Calm Trend Rider 4H
 * ex: binance
 * syms: XRP/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Same mechanism that beat buy-and-hold on BTC 4h: ride the
 * long trend (price above its 300-bar average) but enter only when volatility
 * is calm and exit early when volatility explodes — explosions usually precede
 * a trend break. Tested on XRP because its cycle shape differs from BTC's.
 * When it buys and sells: Buy when XRP closes above its 300-bar average AND the
 * ATR is below 1.2x its 60-bar median (calm). Sell when the ATR jumps above
 * 2.2x its median (hot), price falls back below the 300-bar average, or a 15%
 * disaster stop is hit.
 * When it does NOT work: In a strong bull that runs on high volatility XRP can
 * outpace this strategy because the calm filter keeps us out of the most
 * explosive legs — we can lag buying-and-holding in a parabolic rally.
 */
function onUpdate(ctx) {
  const s = ctx.state;
  const sma300 = ctx.sma(300, 1);
  const atr = ctx.atr(14, 1);
  if (sma300 == null || atr == null) return null;

  // rolling 60-bar ATR median (volatility regime, same as the BTC champion)
  if (!s.atrs) s.atrs = [];
  s.atrs.push(atr);
  if (s.atrs.length > 60) s.atrs.shift();
  if (s.atrs.length < 30) return null;
  const sorted = s.atrs.slice().sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];

  const prevClose = ctx.closes.at(-2);
  const above = prevClose > sma300;
  const calm = atr < med * 1.2; // enter only when volatility is not spiking
  const hot = atr > med * 2.2;  // volatility explosion = trend break warning

  const inPos = ctx.position > 0;
  const stopPx = ctx.entryPx != null ? ctx.entryPx * 0.85 : null;

  // exits: hot volatility, trend break, or 15% disaster stop
  if (inPos && (hot || !above || (stopPx != null && ctx.price <= stopPx))) {
    ctx.watch([
      { side:'sell', price: sma300, trigger:'below', note:'SMA300 trend break', conds:[{ label:'ATR hot', ok: hot }] },
      { side:'sell', price: stopPx != null ? stopPx : sma300, trigger:'below', note:'15% stop' }
    ]);
    return { side:'sell', qty: ctx.position, reduceOnly:true };
  }

  // entry: uptrend and calm volatility
  if (!inPos && above && calm) {
    const stop = prevClose * 0.85;
    ctx.watch([
      { side:'buy', price: sma300, trigger:'above', note:'SMA300 + calm', conds:[{ label:'ATR calm', ok: calm }] },
      { side:'sell', price: stop, trigger:'below', note:'15% stop' }
    ]);
    return { side:'buy', qty: ctx.cash / ctx.price * 0.99 };
  }

  ctx.watch([]);
  return null;
}
