/*
 * @coinsori-strategy v1
 * name: BTC VIX-Vol-Targeted Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC's worst drawdowns happen when external risk-off (VIX spiking) hits crypto. This strategy rides a 200-bar uptrend but sizes every position by current volatility (smaller position when ATR is high) and steps aside when the VIX fear index spikes above its own recent norm. External volatility is a different data family than price-derived ATR, and sizing (not a hard gate) is what keeps it in the market during rallies.
 * When it buys and sells: buys when the previous bar closes above the 200-bar average, the VIX fear index is below 1.0 z-score of its own recent history, and position size is scaled down when ATR is high (vol-targeting); sells when price closes below the 200-bar average, when VIX spikes above 1.2 z-score, or on a 15% hard stop.
 * When it does NOT work: in a long bull where VIX stays elevated (or chop pushes its z-score up), the VIX filter keeps it flat and it misses the rally. Vol-targeting cuts the size of winning trades, so in a steady low-vol bull it underperforms full-size holding. In sideways chop the trend filter whipsaws.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // VIX z-score vs its own recent history (external risk sentiment; 2-day lag already applied, no look-ahead)
  const vix = ctx.data("base_vix");
  if (vix == null) { ctx.watch([]); return null; }
  const vh = ctx.state.vixHist || [];
  vh.push(vix);
  if (vh.length > 120) vh.shift();
  ctx.state.vixHist = vh;
  if (vh.length < 60) { ctx.watch([]); return null; }
  const mean = vh.reduce((a, b) => a + b, 0) / vh.length;
  const sd = Math.sqrt(vh.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vh.length);
  const vixZ = sd < 1e-9 ? 0 : (vix - mean) / sd;

  // ATR median for vol-targeting: position size inversely proportional to current ATR vs its median
  const ah = ctx.state.atrHist || [];
  ah.push(atr);
  if (ah.length > 120) ah.shift();
  ctx.state.atrHist = ah;
  if (ah.length < 60) { ctx.watch([]); return null; }
  const sorted = [...ah].sort((a, b) => a - b);
  const atrMed = sorted[Math.floor(sorted.length / 2)];
  // vol-target: full size at median vol, scale down to 30% as ATR rises ~3x above median
  const sizeFrac = Math.max(0.3, Math.min(1.0, atrMed / (atr * 1.0)));

  const enterLvl = sma200 * 1.01;
  const exitLvl = sma200 * 0.99;

  if (ctx.position <= 0) {
    ctx.watch([{
      side: 'buy', price: enterLvl, trigger: 'above', note: 'above SMA200',
      conds: [{ label: 'VIX z', now: Math.round(vixZ * 100) / 100, op: '<', ref: 1.0 }]
    }]);
    if (prevClose > enterLvl && vixZ < 1.0) {
      return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.98 * sizeFrac };
    }
    return null;
  }

  const stopPx = ctx.entryPx == null ? null : ctx.entryPx * 0.85;
  const watch = [
    { side: 'sell', price: exitLvl, trigger: 'below', note: 'below SMA200' },
    { side: 'sell', price: ctx.price, trigger: 'above', note: 'VIX spike',
      conds: [{ label: 'VIX z', now: Math.round(vixZ * 100) / 100, op: '>', ref: 1.2 }] }
  ];
  if (stopPx != null) watch.push({ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' });
  ctx.watch(watch);

  if (prevClose < exitLvl || vixZ > 1.2) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  if (stopPx != null && ctx.price <= stopPx) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
