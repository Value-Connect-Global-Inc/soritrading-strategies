/*
 * @coinsori-strategy v1
 * name: ETH VIX-Z Regime Filter 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: Crypto is a high-beta risk asset — when stock-market fear (the VIX index) is calm, risk assets tend to trend up; when fear spikes, they get sold. This strategy uses the VIX as a risk-on/risk-off gate for holding ETH.
 * When it buys and sells: It buys ETH when the VIX is calm (its z-score below +0.5 versus its own recent history) and the price is above its 100-bar average (uptrend). It sells when the price falls back below that average, when the VIX turns stressed (z-score above +1.5), or if the price drops 8% below the entry price.
 * When it does NOT work: In a choppy sideways market the 100-bar average whipsaws and it pays fees on false trend breaks. It can miss the first leg of a sharp rebound that happens while the VIX is still elevated.
 */
function onUpdate(ctx) {
  const vix = ctx.data("base.vix");
  if (vix == null) return null;

  const s = ctx.state;
  if (!s.vixHist) s.vixHist = [];
  if (s.vixHist[s.vixHist.length - 1] !== vix) s.vixHist.push(vix);   // one entry per distinct daily VIX value
  if (s.vixHist.length > 200) s.vixHist.shift();
  if (s.vixHist.length < 60) return null;   // need ~3 months of daily VIX to judge calm vs stressed

  const n = s.vixHist.length;
  let mean = 0, i;
  for (i = 0; i < n; i++) mean += s.vixHist[i];
  mean /= n;
  let sd = 0;
  for (i = 0; i < n; i++) sd += (s.vixHist[i] - mean) * (s.vixHist[i] - mean);
  sd = Math.sqrt(sd / n);
  const z = sd > 0 ? (vix - mean) / sd : 0;

  const ema = ctx.ema(100, 1);
  if (ema == null) return null;
  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    const stop = (ctx.entryPx != null) ? ctx.entryPx * 0.92 : null;   // hard stop 8% below entry caps per-trade loss
    const watch = [
      { side: 'sell', price: ema, trigger: 'below', note: 'trend break' },
      { side: 'sell', price: ctx.price, trigger: 'below', note: 'VIX stress', conds: [{ label: 'VIX z', now: z, op: '>=', ref: 1.5, closed: true }] }
    ];
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'hard stop' });
    ctx.watch(watch);
    if (z >= 1.5) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price < ema) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stop != null && price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // flat
  ctx.watch([
    { side: 'buy', price: ema, trigger: 'above', note: 'trend up', conds: [{ label: 'VIX z', now: z, op: '<=', ref: 0.5, closed: true }] }
  ]);
  if (z <= 0.5 && price > ema) {
    return { side: 'buy', qty: ctx.cash / price * 0.99 };
  }
  return null;
}
