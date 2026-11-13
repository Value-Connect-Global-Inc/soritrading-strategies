/*
 * @coinsori-strategy v1
 * name: Oversold Bounce Rotation 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, BNB/USDT, XRP/USDT, DOGE/USDT
 * interval: 4h
 * cash: 10000
 *
 * Mean-reversion rotation: every day we look at the same basket of large-cap
 * coins and buy the single one that has pulled back the most below its 20-bar
 * average, but only if that coin is still in a long-term uptrend (above its
 * 200-bar average). We sell when the price climbs back to its short average.
 * Bet: in an uptrend, sharp short dips tend to bounce, and buying only the
 * deepest dip avoids the drag of the rest of the basket.
 * When it does NOT work: in a choppy range the 20-bar average is recrossed
 * often and fees pile up; a falling coin can keep falling after we buy, so a
 * 10% stop-loss is always armed.
 */
function onUpdate(ctx) {
  const SMAF = 20;    // short mean for the pullback signal (4h x 20 = ~3 days)
  const TREND = 200;  // long-term trend filter: only buy pullbacks in an uptrend (~33 days)
  const ENTRY = 0.04; // buy when the coin is at least 4% below its short mean (judgement: meaningful dip)
  const STOP = 0.10;  // hard stop: mean-reversion thesis is wrong if it falls 10% (judgement)
  const REVIEW = 6;   // review every 6 bars = 1 day (pick the deepest dip daily)

  if (ctx.closes.length < TREND + 3) return null;
  const prevClose = ctx.closes.at(-2);
  const sma20 = ctx.sma(SMAF, 1);
  const sma200 = ctx.sma(TREND, 1);
  if (sma20 == null || sma200 == null) return null;

  const pullback = (sma20 - prevClose) / sma20; // >0 means price is below its short mean
  const inTrend = prevClose > sma200;

  // publish own pullback into shared state for the daily ranking
  ctx.state = ctx.state || {};
  const st = ctx.state;
  st[ctx.sym] = { pb: pullback, trend: inTrend };

  const basket = (ctx.syms && ctx.syms.length >= 2) ? ctx.syms : [ctx.sym];
  const pos = ctx.position;
  const entry = ctx.entryPx;
  const stopLvl = entry != null ? entry * (1 - STOP) : null;

  // hard stop always armed while holding
  if (pos > 0 && stopLvl != null && ctx.lows.at(-1) <= stopLvl) {
    ctx.watch([{ side: 'sell', price: stopLvl, trigger: 'below', note: '10% stop' }]);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  // exit as soon as price is back at/above the short mean (bounce complete)
  if (pos > 0 && prevClose >= sma20) {
    ctx.watch([{ side: 'sell', price: sma20, trigger: 'above', note: 'back to mean' }]);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  // daily review, synchronized on calendar time so all coins review together
  const barSec = (ctx.times.at(-1) - ctx.times.at(-2)) / 1000;
  const timeSec = Math.floor(ctx.times.at(-1) / 1000);
  const isRev = (timeSec % (REVIEW * barSec)) < barSec;
  const nextRev = timeSec + REVIEW * barSec;

  if (!isRev) {
    if (pos > 0) {
      ctx.watch([{ side: 'sell', price: sma20, trigger: 'above', note: 'back to mean' },
                 { side: 'sell', price: stopLvl != null ? stopLvl : 0, trigger: 'below', note: '10% stop' }]);
    } else {
      ctx.watch([{ side: 'buy', at: nextRev, note: 'daily review' }]);
    }
    return null;
  }

  // daily review: pick the deepest pullback among coins still in an uptrend
  let best = null;
  for (const s of basket) {
    const d = st[s];
    if (d == null || !d.trend) continue;
    if (best == null || d.pb > best.pb) best = { sym: s, pb: d.pb };
  }
  const isTarget = best != null && best.sym === ctx.sym && best.pb >= ENTRY;

  if (pos > 0 && !isTarget) {
    ctx.watch([{ side: 'sell', at: nextRev, note: 'daily review' }]);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  if (pos <= 0 && isTarget) {
    ctx.watch([{ side: 'buy', at: nextRev, note: 'daily review',
      conds: [{ label: 'pullback', now: pullback, op: '>=', ref: ENTRY, closed: true }] }]);
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: sma20, trigger: 'above', note: 'back to mean' },
               { side: 'sell', price: stopLvl != null ? stopLvl : 0, trigger: 'below', note: '10% stop' }]);
  } else {
    ctx.watch([{ side: 'buy', at: nextRev, note: 'daily review' }]);
  }
  return null;
}
