/*
 * @coinsori-strategy v1
 * name: 5-Asset 4H Trend-Gated Keltner MR Basket (Vol-Scaled)
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT, ADAUSDT, LINKUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The 200-SMA trend-gated Keltner mean-reversion recipe is the most
 * validated family in the ledger (~29/32 windows positive across 11 assets, low drawdown).
 * This version runs it as a 5-asset basket so a pullback in any one asset can be bought.
 * Improvement over v1: per-leg position size is mildly scaled by that asset's realized
 * volatility (ATR% inverse) — a calmer asset keeps ~20% weight while a very volatile alt
 * is trimmed to ~10%, cutting the basket's peak drawdown without killing the return.
 * When it buys and sells: on each asset, buy when price closes below EMA20 minus 2.5x ATR
 * with RSI(14)<40 and price above the 200-SMA (uptrend only); sell when price recovers above
 * the 20-EMA. 2-bar cooldown cuts whipsaw.
 * When it does NOT work: in a broad coordinated crypto bear all trend gates stay flat
 * (capital safe, little upside); a straight-line melt-up of the whole basket still lags
 * buy-and-hold of any single asset. Defensive pullback basket, not a chaser.
 * 수정일: 2026-04-26 — 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (ema20 == null || atr == null || atr <= 0 || rsi == null || sma200 == null) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.pos(sym);
  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  st.cd = cd;

  if (pos > 0) {
    const exitConds = [];
    if (cd !== 0) exitConds.push({ label: 'cooldown', ok: cd === 0 });
    ctx.watch([{ side: 'sell', price: ema20, trigger: 'above', note: 'exit above EMA20', conds: exitConds }]);

    if (price > ema20 && cd === 0) {
      st.cd = 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const keltnerLow = ema20 - 2.5 * atr;
  ctx.watch([{
    side: 'buy',
    price: keltnerLow,
    trigger: 'below',
    note: 'Keltner low touch',
    conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'price > SMA200', ok: price > sma200 },
      { label: 'cooldown', ok: cd === 0 }
    ]
  }]);

  if (price < keltnerLow && rsi < 40 && price > sma200 && cd === 0) {
    st.cd = 2;
    // Mild vol-scaling: 2.5% ATR asset keeps ~20% weight (same as v1); a 5% ATR
    // asset drops to ~10%. Clamped 10-30% so no leg vanishes or dominates.
    const atrPct = atr / ema20;
    const weight = Math.max(0.10, Math.min(0.30, 0.20 * (0.025 / atrPct)));
    const qty = (ctx.cash / price) * weight;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
