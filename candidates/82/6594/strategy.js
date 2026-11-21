/*
 * @coinsori-strategy v1
 * name: BTC 4h De-Risk Trend + USD Regime Filter
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A trend filter rides big uptrends but takes deep drawdowns in slow
 * declines that moving averages lag (e.g. 2021-2022). This version adds a macro regime
 * filter: when the broad US dollar is surging (risk-off for crypto), it steps aside even
 * while BTC's own trend is still intact, and returns when the dollar calms. The dollar is
 * a slow signal that catches slow declines the fast volatility filters miss.
 * When it buys: EMA50 above EMA200 (uptrend) and the dollar is not surging.
 * When it sells: EMA50 falls below EMA200, price hits the -20% hard stop, volatility
 * de-risks to 40%, or the dollar rises more than 3% over 90 days (restore below 1.5%).
 * When it does NOT work: in a crypto bull that runs alongside a strong dollar the USD
 * filter steps out and gives up upside; a -20% stop can be hit by a sharp intra-trend
 * shakeout and force a re-entry at a worse price.
 */

function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const atrF = ctx.atr(14, 1);
  const atrS = ctx.atr(100, 1);
  if (atrF == null || atrS == null) return null;
  const e50Prev = ctx.ema(50, 6); // 50-EMA direction ~1 day ago (6 x 4h)
  if (e50Prev == null) return null;

  const price = ctx.price;
  const now = ctx.times.at(-1);

  // --- US dollar regime filter ---
  // A surging broad dollar = liquidity tightening = risk-off for crypto. A SLOW signal
  // (90-day change) catches slow declines that fast volatility filters miss.
  const usd = ctx.data("base_usd_broad");
  let usdRisk = ctx.state.usdRisk === true;
  let usdChg = null;
  if (usd != null) {
    let hist = ctx.state.usdHist || [];
    const last = hist.length ? hist[hist.length - 1] : null;
    if (!last || Math.abs(last.v - usd) > 1e-9) {
      hist.push({ t: now, v: usd });
      if (hist.length > 500) hist = hist.slice(-500);
      ctx.state.usdHist = hist;
    }
    if (hist.length >= 2) {
      const cutoff = now - 90 * 86400;
      let oldest = hist[0];
      for (let i = 1; i < hist.length; i++) {
        if (hist[i].t <= cutoff) oldest = hist[i];
        else break;
      }
      usdChg = usd / oldest.v - 1;
      if (usdChg > 0.03) usdRisk = true;        // USD up >3% in 90d = risk-off
      else if (usdChg < 0.015) usdRisk = false; // USD calmed: restore (hysteresis)
      ctx.state.usdRisk = usdRisk;
    }
  }

  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const ratio = atrF / atrS; // fast vs slow volatility; >1 = more volatile than normal
  const falling = e50 < e50Prev; // trend rolling over, not a launch

  // hysteresis: de-risk at 2.2x normal vol ONLY while the trend falls, restore under 1.5x
  const deRisked = ctx.state.deRisked === true;
  const shouldDeRisk = ratio >= 2.2 && falling;
  const shouldRestore = ratio <= 1.5;

  // hard stop: 20% below entry cost basis — caps any single position's loss in a fast crash
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;

  const watch = [
    { side:'buy', price: e200, trigger:'above', note:'EMA50 over EMA200 (uptrend)', conds:[{label:'EMA50', now: e50, op:'>', ref: e200, closed:true}] },
    { side:'sell', price: e200, trigger:'below', note:'trend broke' },
  ];
  if (inPos) {
    watch.push({ side:'sell', price: stop, trigger:'below', note:'hard stop' });
    if (usdChg != null) {
      watch.push({ side:'sell', price: price, trigger:'below', note:'USD risk-off', conds:[{label:'USD 90d chg', now: usdChg, op:'>', ref: 0.03, closed:true}] });
    }
  }
  ctx.watch(watch);

  // USD risk-off: step aside while the dollar surges, even if the BTC trend is intact
  if (inPos && usdRisk) {
    ctx.state.deRisked = false;
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }

  // hard stop exit: protect the account when the trend flip lags a fast crash
  if (inPos && ctx.entryPx != null && price <= stop) {
    ctx.state.deRisked = false;
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }

  // full exit on trend flip
  if (!up && inPos) {
    ctx.state.deRisked = false;
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }

  const equity = ctx.cash + ctx.position * price;

  // enter full size unless volatility is already extreme (deRisked) or the dollar is surging
  if (up && !inPos && !usdRisk) {
    const qty = deRisked ? (equity / price) * 0.4 : (equity / price) * 0.99;
    return { side:'buy', qty: qty };
  }

  if (up && inPos && !usdRisk) {
    if (!deRisked && shouldDeRisk) {
      // crash signature: cut to 40% to protect the account from a fast decline
      ctx.state.deRisked = true;
      const target = (equity / price) * 0.4;
      const diff = ctx.position - target;
      if (diff > (equity / price) * 0.05) return { side:'sell', qty: diff * 0.99, reduceOnly: true };
    } else if (deRisked && shouldRestore) {
      // volatility calmed: go back to full
      ctx.state.deRisked = false;
      const target = (equity / price) * 0.99;
      const diff = target - ctx.position;
      if (diff > (equity / price) * 0.05) return { side:'buy', qty: diff * 0.99 };
    }
  }
  return null;
}
