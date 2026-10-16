/*
 * @coinsori-strategy v1
 * name: MultiAsset OBV Volume-Flow Trend 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the validated OBV volume-flow champion (BTC 1d, +318/+45
 * on disjoint windows) uses On-Balance Volume to track whether money flows in
 * or out over time — a signal source entirely different from the EMA50/200
 * price-cross core. This widens that family to a 4-asset 4h basket so a single
 * asset's crash cannot sink the account, on the faster timeframe where the
 * price-cross core already proved robust.
 * When it buys and sells: on each asset, buy when the 45-bar OBV trend is
 * clearly rising AND price is above its 100-bar average AND today's volume is
 * above its 30-bar average (the flow is real, not a quiet drift). Sell when
 * the 45-bar OBV trend turns down by 1.5%. A 5-bar cooldown after each flip
 * cuts whipsaw; ATR-scaled size cuts exposure in volatile regimes.
 * When it does NOT work: OBV can diverge from price for long stretches in
 * choppy sideways markets, causing flips and fee churn; like all trend
 * signals it lags sharp V-shaped melt-ups where volume spikes before the
 * 45-bar average catches up, and it is long-only so a sustained bear market
 * across all coins is flat-to-loss.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  if (sma100 == null || atr == null) return null;

  const LOOKBACK = 45;
  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < LOOKBACK + 2) return null;

  // Incremental OBV: keep a running value in state and update it each bar
  // from the current close vs previous close and current volume. O(1) per
  // bar, so it scales to 5000-bar windows (recomputing from scratch each bar
  // timed out).
  const st = ctx.state || {};
  if (!st.obvInit) {
    let obv = 0;
    for (let k = 1; k < closes.length; k++) {
      const c = closes[k], p = closes[k - 1], v = vols[k];
      if (!Number.isFinite(c) || !Number.isFinite(p) || !Number.isFinite(v)) continue;
      if (c > p) obv += v;
      else if (c < p) obv -= v;
    }
    st.obv = obv;
    st.obvHist = [];
    st.obvInit = true;
  }
  const prevC = closes.at(-2);
  const vNow = ctx.vol;
  if (Number.isFinite(prevC) && Number.isFinite(vNow)) {
    if (price > prevC) st.obv += vNow;
    else if (price < prevC) st.obv -= vNow;
  }
  st.obvHist.push(st.obv);
  if (st.obvHist.length > LOOKBACK + 1) st.obvHist.shift();

  if (st.obvHist.length < LOOKBACK + 1) return null;
  const obvNow = st.obvHist[st.obvHist.length - 1];
  const obvPast = st.obvHist[st.obvHist.length - 1 - LOOKBACK];
  // Hysteresis: 1% to enter, 1.5% to exit — the asymmetry keeps us in a
  // running trend and only flips out on a clear distribution turn.
  const rising = obvNow > obvPast * 1.01;
  const falling = obvNow < obvPast * 0.985;

  // Volume confirmation: only enter when today's volume beats its 30-bar
  // average — a rising OBV on quiet volume is a weak drift, not accumulation.
  const avgV = ctx.avgVol(30);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  let cd = st.cd || 0;
  if (cd > 0) cd--;
  st.cd = cd;

  // ATR-scaled size: cut exposure when volatility is high so a wide-swing
  // regime cannot blow the account.
  const atrPct = atr / price;
  let sizeFrac = 1.0;
  if (atrPct > 0.06) sizeFrac = Math.max(0.5, 1.0 - (atrPct - 0.06) / 0.06);

  if (pos > 0) {
    ctx.watch([{ side: 'sell', note: 'OBV trend exit', conds: [
      { label: 'OBV falling 1.5%', ok: falling },
      { label: 'Cooldown ready', ok: cd === 0 }
    ]}]);
    if (falling && cd === 0) {
      st.cd = 5;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma100, trigger: 'above', note: 'Price above SMA100', conds: [
    { label: 'OBV rising 1%', ok: rising },
    { label: 'Volume > avg(30)', ok: volOk },
    { label: 'Cooldown ready', ok: cd === 0 }
  ]}]);

  if (rising && price > sma100 && volOk && cd === 0) {
    st.cd = 5;
    // With 4 assets in the basket, use a smaller share per asset than the
    // single-asset champion (which used 0.95) so total exposure stays sane.
    const qty = (ctx.cash / price) * 0.25 * sizeFrac;
    return { side: 'buy', qty: qty };
  }
  return null;
}
