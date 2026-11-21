/*
 * @coinsori-strategy v1
 * name: ETH Bollinger Mean-Reversion 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: after a sharp drop to the lower Bollinger band, ETH tends to bounce back toward the mean (mean reversion) — a different family from the trend/funding strategies tried before.
 * When it buys and sells: buys when price closes below the lower Bollinger band AND RSI is oversold; sells at the middle band (mean) or on a hard stop. Long-only spot.
 * When it does NOT work: in strong sustained downtrends price keeps falling through the lower band and the bounce never comes — the stop-loss eats small losses repeatedly. Also loses to holding in steady uptrends where price rarely touches the lower band.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const prevClose = ctx.closes.at(-2);
  if (bb == null || rsi == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }

  const mid = bb.mid;
  const lower = bb.lower;
  const upper = bb.upper;

  if (ctx.position <= 0) {
    // Entry: close below lower band and RSI oversold (<30) — mean-reversion long.
    if (prevClose < lower && rsi < 30) {
      const qty = ctx.cash / ctx.price * 0.95;
      ctx.watch([{ side:'buy', price: lower, trigger:'below', note:'BB lower touch', conds:[{label:'RSI(14) close', now:rsi, op:'<', ref:30, closed:true}] },
                 { side:'sell', price: mid, trigger:'above', note:'mean target' }]);
      return { side:'buy', qty: qty };
    }
    ctx.watch([{ side:'buy', price: lower, trigger:'below', note:'BB lower touch' }]);
    return null;
  }

  // Exit: at middle band (mean) or hard stop below entry.
  const entry = ctx.entryPx;
  if (entry == null) { ctx.watch([]); return null; }
  const stop = entry * 0.95; // 5% hard stop, sized so a single loss is acceptable
  const target = mid;
  ctx.watch([{ side:'sell', price: target, trigger:'above', note:'mean target' },
             { side:'sell', price: stop, trigger:'below', note:'5% stop' }]);
  if (ctx.price >= target) return { side:'sell', qty: ctx.position, reduceOnly: true };
  if (ctx.price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
