/*
 * @coinsori-strategy v1
 * name: Alt Relative Strength Rotation 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: in crypto bull legs a clear leader usually keeps leading
 * for weeks. Rotating into the strongest relative performer captures that lead
 * instead of being stuck in a laggard — but only while the broad market (BTC)
 * is itself in an uptrend.
 * When it buys and sells: it rotates only while BTC is above its long-term EMA.
 * Every 7 days it ranks the symbols by 30-day momentum and holds the single
 * strongest one that is also up more than 5% over 30 days. It switches only
 * when a new leader is 6% stronger, stops out any position 20% below its entry,
 * and exits to cash entirely when BTC turns bearish.
 * When it does NOT work: it underperforms when momentum whipsaws (leaders
 * reverse quickly) and it cannot beat holding a single moon-shot asset that
 * dominates the whole window. In a broad bear market it sits in cash.
 */
function onUpdate(ctx) {
  const momN = 180;      // 30 days momentum lookback
  const trendN = 150;    // ~25 days per-asset trend filter
  const margin = 0.06;   // 6% momentum lead required before switching
  const absMomMin = 0.05; // leader must be up >5% over 30d to enter
  const stopPct = 0.20;  // hard stop 20% below entry
  const rebalEvery = 42; // re-rank every 7 days
  const regN = 200;      // BTC regime EMA (~33 days)

  // Score every symbol in the universe.
  let scores = [];
  for (const sym of ctx.syms) {
    let closes, price;
    if (sym === ctx.sym) {
      closes = ctx.closes;
      price = ctx.price;
    } else {
      const m = ctx.market(sym);
      if (!m) continue;
      closes = m.closes;
      price = m.price;
    }
    if (!closes || closes.length < momN + 2) continue;
    const now = price != null ? price : closes[closes.length - 1];
    const past = closes[closes.length - 1 - momN];
    if (now == null || past == null || past <= 0) continue;
    const mom = now / past - 1;
    const k = 2 / (trendN + 1);
    let ema = closes[0];
    for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
    scores.push({ sym, mom, aboveTrend: now > ema, price: now, closes });
  }
  if (scores.length === 0) return null;

  // BTC regime gate from the scored universe (symbols are stored without /USDT).
  const btc = scores.find(s => s.sym.toUpperCase().indexOf('BTC') === 0);
  let btcBull = false;
  if (btc && btc.closes.length >= regN + 2) {
    const k = 2 / (regN + 1);
    let ema = btc.closes[0];
    for (let i = 1; i < btc.closes.length; i++) ema = btc.closes[i] * k + ema * (1 - k);
    btcBull = btc.price > ema;
  }

  const barSec = 4 * 3600;
  const nextBar = ctx.times[ctx.times.length - 1] + barSec;

  // Bear regime: exit to cash, do not trade.
  if (!btcBull) {
    ctx.watch([{ side: 'sell', at: nextBar, note: 'wait for BTC bull' }]);
    if (ctx.position > 0) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  const my = scores.find(s => s.sym === ctx.sym);
  const eligible = scores.filter(s => s.aboveTrend && s.mom > absMomMin);

  // Declare what we wait for: the stop level (if holding) and the next
  // rotation recheck time.
  const watch = [];
  if (ctx.position > 0 && ctx.entryPx != null) {
    watch.push({ side: 'sell', price: ctx.entryPx * (1 - stopPct), trigger: 'below', note: 'stop-loss' });
  }
  watch.push({ side: 'buy', at: nextBar, note: 'rotation recheck' });
  watch.push({ side: 'sell', at: nextBar, note: 'rotation recheck' });
  ctx.watch(watch);

  // Hard stop-loss first (active every bar).
  if (ctx.position > 0 && ctx.entryPx != null && ctx.price <= ctx.entryPx * (1 - stopPct)) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }

  // Only re-rank on the rebalance cadence; hold in between.
  if (ctx.i % rebalEvery !== 0) return null;

  if (eligible.length === 0) {
    if (ctx.position > 0) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  eligible.sort((a, b) => b.mom - a.mom);
  const leader = eligible[0];
  const runnerUp = eligible[1] || null;

  if (ctx.position > 0) {
    if (my && my.aboveTrend && (leader.sym === ctx.sym || leader.mom - my.mom <= margin)) return null;
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  if (leader.sym === ctx.sym && (runnerUp === null || my.mom - runnerUp.mom >= margin)) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
