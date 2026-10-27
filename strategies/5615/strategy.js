/*
 * @coinsori-strategy v1
 * name: BTC Macro Risk-On Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC is a risk asset whose crashes cluster with equity
 * volatility spikes. The CBOE VIX (a macro fear gauge, already lagged 2 days
 * in this data) sees risk-off that price-only volume signals lag, so gating a
 * long-trend position on a calm-VIX regime should dodge the worst drawdowns.
 * When it buys and sells: buys when VIX is calm (below ~28) AND price is in a
 * long uptrend (above its 200-day average with the 50-day above the 200-day);
 * sells when VIX turns stressed (28+) or the 200-day trend breaks.
 * When it does NOT work: in slow grinding bear markets where VIX stays low
 * (no fear spike to gate on) it relies on the trend break alone and can give
 * back gains; and it misses sharp V-shaped recoveries that start while VIX is
 * still elevated.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const vix = ctx.data("base_vix");
  const sma200 = ctx.sma(200, 1);
  const ema50 = ctx.ema(50, 1);
  if (vix == null || sma200 == null || ema50 == null) return null;

  // VIX ~28 = elevated stress (above its long-run mean + ~1 sigma): risk-off regime.
  const riskOn = vix < 28;
  // Long-term uptrend + intermediate momentum aligned.
  const trendUp = price > sma200 && ema50 > sma200;

  const pos = ctx.position;
  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: price, trigger: 'above', note: 'VIX stress exit', conds: [{ label: 'VIX >= 28', ok: !riskOn }] }
    ]);
    if (!riskOn && cd === 0) {
      ctx.state.cd = 3;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (price < sma200 && cd === 0) {
      ctx.state.cd = 3;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: price, trigger: 'above', note: 'Risk-on trend entry', conds: [
      { label: 'VIX < 28', ok: riskOn },
      { label: 'Price > SMA200', ok: price > sma200 },
      { label: 'EMA50 > SMA200', ok: ema50 > sma200 }
    ]}
  ]);
  if (riskOn && trendUp && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 3;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
