/*
 * @coinsori-strategy v1
 * name: BB Squeeze Breakout BTC
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: When volatility compresses to an extreme, the next move is often a sharp breakout. Trading the direction of the first break from a squeeze catches the start of a trend.
 * When it buys and sells: Buys when the Bollinger band width is in its narrowest 20% of the last 100 days (a squeeze) and the close breaks above the upper band; sells when the close falls back below the middle band or a 15% stop loss is hit.
 * When it does NOT work: In a falling market the squeeze resolves downward and the breakout buy is immediately stopped out; squeezes can also fail to resolve and just drift. Expect repeated small stop losses in chop.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  if (bb == null || bb.upper == null || bb.lower == null || bb.mid == null) return null;
  const width = (bb.upper - bb.lower) / bb.mid;

  // track the last 100 widths to define "squeeze" as the narrowest 20% of the recent range
  const history = ctx.state.widthHist || [];
  history.push(width);
  if (history.length > 100) history.shift();
  ctx.state.widthHist = history;
  if (history.length < 100) return null;

  const sorted = history.slice().sort((a, b) => a - b);
  const squeezeThreshold = sorted[19]; // 20th percentile of the last 100 widths
  const squeezed = width <= squeezeThreshold;

  const px = ctx.price;
  const entryPx = ctx.entryPx;

  if (ctx.position <= 0) {
    if (squeezed && px > bb.upper) {
      ctx.watch([{ side:'sell', price: bb.mid, trigger:'below', note:'BB mid' },
                 { side:'sell', price: px * 0.85, trigger:'below', note:'15% stop' }]);
      return { side:'buy', qty: ctx.cash / px * 0.99 };
    }
    ctx.watch([{ side:'buy', price: bb.upper, trigger:'above', note:'squeeze breakout',
                 conds:[{ label:'BB width', now: width, op:'<=', ref: squeezeThreshold, closed:true }] }]);
    return null;
  }

  // holding: exit when price falls back inside the bands (mean) or the hard stop is hit
  const stopPx = entryPx != null ? entryPx * 0.85 : null;
  const stopHit = stopPx != null && px <= stopPx;
  const exit = px < bb.mid || stopHit;

  const w = [{ side:'sell', price: bb.mid, trigger:'below', note:'BB mid' },
             { side:'sell', price: stopPx != null ? stopPx : px * 0.85, trigger:'below', note:'15% stop' }];
  ctx.watch(w);

  if (exit) return { side:'sell', qty: ctx.position };
  return null;
}
