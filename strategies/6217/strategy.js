/*
 * @coinsori-strategy v1
 * name: BTC On-chain Trend Confirmation 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: Trend-following on BTC 4h passed in this job (+20/+41/+40% on the EMA50/200 core).
 * On-chain activity (daily unique active addresses) is an independent confirmation: when
 * real network usage is expanding, a breakout is backed by demand. Gating trend entries
 * with on-chain activity should cut false breakouts. The on-chain signal is only used on
 * entries — as an exit it whipsaws (daily data oscillates around its 30-day average).
 * When it buys/sells: buy on a bullish EMA50/200 crossover (or re-entry while EMA50>EMA200
 * and price above SMA400) AND active addresses are above their 30-day average. Sell on a
 * death cross or a 2.5xATR stop.
 * When it fails: in a price rally not backed by on-chain usage it stays out (misses fake
 * pumps); on-chain data can lag price in the early stage of a real bull and delay entries.
 * Long-only means a sustained bear market is flat-to-loss.
 */

function onUpdate(ctx) {
  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const fp = ctx.ema(50, 2), sp = ctx.ema(200, 2);
  const sma200 = ctx.sma(200, 1);
  const sma400 = ctx.sma(400, 1);
  const atr = ctx.atr(14, 1);
  if (f == null || s == null || fp == null || sp == null || sma200 == null || sma400 == null || atr == null) {
    ctx.watch([]); return null;
  }

  const addr = ctx.data("main.addr");
  const addr30 = ctx.data("main.addr_sma30");
  if (addr == null || addr30 == null) { ctx.watch([]); return null; }   // on-chain data not available yet

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  const pos = ctx.position || 0;

  // ---- exits ----
  if (pos > 0) {
    const stopPx = (ctx.entryPx == null ? prevClose : ctx.entryPx) - 2.5 * atr;
    const deathCross = fp > sp && f <= s;
    ctx.watch([
      { side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop 2.5ATR' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'death cross',
        conds: [{ label: 'EMA50<EMA200', ok: deathCross, closed: true }] }
    ]);
    if (price <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    if (deathCross) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // ---- entries (flat) ----
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';
  if (!allocOk) { ctx.watch([]); return null; }

  const freshCross = fp <= sp && f > s && prevClose > sma200;
  const reentry = f > s && prevClose > sma400;
  const activityUp = addr > addr30;   // on-chain must confirm demand at entry

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'fresh cross entry',
      conds: [{ label: 'EMA cross up', ok: freshCross, closed: true },
              { label: 'addr>addr30', ok: activityUp, closed: true }] },
    { side: 'buy', price: sma400, trigger: 'above', note: 're-entry trend intact',
      conds: [{ label: 'EMA50>EMA200', ok: reentry, closed: true },
              { label: 'addr>addr30', ok: activityUp, closed: true }] }
  ]);

  if (!freshCross && !reentry) return null;
  if (!activityUp) return null;

  const riskCash = ctx.cash * 0.02;          // risk 2% of cash per trade on the stop
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
