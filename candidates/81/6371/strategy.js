/*
 * @coinsori-strategy v1
 * name: BTC 4h Trend with VIX Regime Filter
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends for long stretches on 4h, but its worst drawdowns tend to cluster with risk-off spikes in equity volatility (VIX). This strategy rides the 4h uptrend but steps aside when VIX runs far above its own recent norm, and sizes each position smaller when BTC's own volatility is high.
 * When it buys and sells: Buys when price is above the 200-bar SMA (4h) and VIX is not far above its own trailing norm; sells when price falls back below the SMA, VIX spikes into risk-off, or a volatility-based stop is hit.
 * When it does NOT work: In a sideways churning market the SMA filter whipsaws and fees pile up; if BTC rallies hard while equity VIX is spiking (a decoupling regime) the filter wrongly keeps it out of a strong move. VIX data arrives with a 2-day lag.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);        // closed-bar trend, no look-ahead
  const atr = ctx.atr(14, 1);
  const vix = ctx.data("base_vix");
  if (sma200 == null || atr == null || vix == null) return null;

  // Own rolling VIX norm kept in state (survives restarts) so the filter
  // compares VIX to ITS OWN history, not a fixed level.
  const st = ctx.state || {};
  let emaVix = st.emaVix;
  if (emaVix == null) emaVix = vix; else emaVix = emaVix * 0.95 + vix * 0.05;
  ctx.state = { emaVix: emaVix };
  const vixElev = (vix - emaVix) / emaVix;   // + = VIX above its norm

  const trendUp = price > sma200;
  const calm = vixElev < 0.15;   // risk-on: VIX within 15% of its own norm (judgement: avoids tiny wiggles, catches real spikes)

  const atrPct = atr / price;
  // Volatility sizing: full size below ~3% ATR, scale down as BTC vol rises, floor 20% (judgement: no ruin on a vol blowup)
  const sizeFrac = Math.max(0.2, Math.min(1.0, 0.03 / Math.max(atrPct, 0.005)));
  const qty = (ctx.cash / price * 0.99) * sizeFrac;

  const stop = ctx.entryPx != null ? ctx.entryPx * (1 - 2.5 * atrPct) : null;   // 2.5x ATR stop = room to breathe, not a noise stop

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 reclaim', conds: [{ label: 'VIX calm', ok: calm }] },
    { side: 'sell', price: sma200, trigger: 'below', note: 'trend break' },
    { side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' }
  ]);

  if (ctx.position > 0) {
    if (!trendUp || !calm || (stop != null && price <= stop)) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }
  if (trendUp && calm) {
    return { side: 'buy', qty: qty };
  }
  return null;
}
