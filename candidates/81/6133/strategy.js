/*
 * @coinsori-strategy v1
 * name: BTC VIX-Gated Trend Ride 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto corrections usually coincide with equity-volatility spikes (VIX jumps). A plain trend ride re-enters during those spikes and gets whipsawed. Gating entries with a VIX z-score (relative to its own recent mean) skips entries while fear is elevated and re-enters once calm returns — a macro regime filter on top of a slow trend.
 * When it buys and sells: Buys when a closed daily bar closes above the 100-day SMA AND the CBOE VIX z-score is below 1.5 (not in a fear spike). Sells when a closed bar closes back below the 100-day SMA.
 * When it does NOT work: In a melt-up with no VIX spikes it behaves like a plain trend ride and can still lag buy-and-hold. If VIX stays structurally high (prolonged macro stress) it sits out for long stretches and misses recoveries.
 */

function onUpdate(ctx) {
  const sma = ctx.sma(100, 1);
  const smaP = ctx.sma(100, 2);
  const closePrev = ctx.closes.at(-2);
  const closePrev2 = ctx.closes.at(-3);
  const vix = ctx.data("base_vix");
  const pos = ctx.position || 0;

  if (sma == null || smaP == null || closePrev == null || closePrev2 == null || vix == null) {
    ctx.watch([]);
    return null;
  }

  // rolling VIX history (last 120 daily values) to compute z-score vs its own recent mean
  const st = ctx.state || {};
  const hist = st.vixHist || [];
  hist.push(vix);
  if (hist.length > 120) hist.shift();
  st.vixHist = hist;
  ctx.state = st;

  let vixZ = null;
  if (hist.length >= 60) {
    let m = 0; for (const v of hist) m += v; m /= hist.length;
    let sd = 0; for (const v of hist) sd += (v - m) * (v - m); sd = Math.sqrt(sd / hist.length);
    vixZ = sd > 0 ? (vix - m) / sd : 0;
  }

  ctx.watch([
    { side:'buy', price: sma, trigger:'above', note:'close>100d SMA, VIX calm', conds:[
        { label:'Prev close > SMA', now:closePrev, op:'>', ref:sma, closed:true },
        { label:'Prev2 close <= SMA', now:closePrev2, op:'<=', ref:smaP, closed:true },
        { label:'VIX z-score < 1.5', now:vixZ, op:'<', ref:1.5, closed:true }
    ]},
    { side:'sell', price: sma, trigger:'below', note:'close < 100d SMA', conds:[
        { label:'Prev close < SMA', now:closePrev, op:'<', ref:sma, closed:true }
    ]}
  ]);

  if (vixZ == null) return null; // not enough VIX history yet

  if (pos <= 0) {
    if (closePrev2 <= smaP && closePrev > sma && vixZ < 1.5) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
    }
    return null;
  }
  if (pos > 0 && closePrev < sma) {
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }
  return null;
}
