/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend Ride 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin's 4h price trends for extended periods once it is clearly above its slow 200-bar average. Two proven defensive/scaling mechanisms from the ETH 4h family are combined: (1) trend-strength sizing — risk scales with distance above the SMA, so strong trends deploy more capital; (2) a slope-gated exit — we only sell below the SMA when the SMA itself is falling, so we stay in during strong rallies that briefly dip under the line (the classic way a plain trend ride misses a parabolic up-move).
 * When it buys and sells: Long on a close above the 200-SMA, sized by risk/ATR where risk grows with distance above the SMA. Sells on a close below the SMA only when the SMA is falling.
 * When it does NOT work: In long sideways chop it whipsaws; in a parabolic mania it still cannot fully keep up with buy-and-hold; the slope gate delays exits, so a sharp top that catches the SMA still rising gives back more than a plain cross exit.
 */

function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  const smaP = ctx.sma(200, 2);
  const sma5 = ctx.sma(200, 5);
  const closePrev = ctx.closes.at(-2);
  const closePrev2 = ctx.closes.at(-3);
  const pos = ctx.position || 0;

  if (sma == null || smaP == null || sma5 == null || closePrev == null || closePrev2 == null) {
    ctx.watch([]);
    return null;
  }

  // SMA is "falling" when the 200-SMA 1 bar ago is below its 5-bar-ago value
  const smaFalling = sma < sma5;

  ctx.watch([
    { side:'buy', price: sma, trigger:'above', note:'SMA200 cross up, sized by strength', conds:[ { label:'Prev close > SMA', now:closePrev, op:'>', ref:sma, closed:true }, { label:'Prev2 close <= SMA', now:closePrev2, op:'<=', ref:smaP, closed:true } ] },
    { side:'sell', price: sma, trigger:'below', note:'SMA200 cross down + SMA falling', conds:[ { label:'Prev close < SMA', now:closePrev, op:'<', ref:sma, closed:true }, { label:'SMA falling', ok:smaFalling } ] }
  ]);

  if (pos <= 0) {
    if (closePrev2 <= smaP && closePrev > sma) {
      const atr = ctx.atr(14, 1);
      if (atr == null || atr <= 0) return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.98 };
      // trend strength = how far price is above the 200-SMA, in %
      const distPct = (closePrev - sma) / sma;
      // risk scales from $300 (weak) up to $1500 (strong), linear in distance
      const risk = 300 + Math.min(Math.max(distPct * 20000, 0), 1200);
      const riskQty = risk / atr;
      const maxQty = (ctx.cash / ctx.price) * 0.98;
      return { side: 'buy', qty: Math.min(riskQty, maxQty) };
    }
    return null;
  }

  if (pos > 0) {
    if (closePrev < sma && smaFalling) {
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }
  return null;
}
