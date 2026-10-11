/*
 * @coinsori-strategy v1
 * name: BTC 1D On-Chain Trend + Momentum Override
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's price follows network adoption — active addresses
 * (real users) growing tends to push price up. The single on-chain signal worked
 * well but lagged strong rallies where price soars while address growth saturates.
 * This version keeps the on-chain regime filter but adds a price-momentum override:
 * in a fast uptrend we hold even if address growth briefly flattens, so we don't
 * sell too early in a melt-up.
 * When it buys and sells: Buy when the 30-day active-address level is above its
 * ~90-day average (network growing) AND price is above its 200-day average. Sell
 * when network growth fades UNLESS price is strongly trending up (fast 20-day
 * momentum) — in that case we ride the melt-up until momentum breaks. A 20-bar
 * cooldown after each exit stops churn.
 * When it does NOT work: In a bear market addresses decline and we stay flat
 * (defensive, so we lag a sharp V-reversal off the bottom). The momentum override
 * can keep us in near a blow-off top, adding drawdown. On-chain data updates daily,
 * so it cannot react to intraday news.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // On-chain active addresses, 30-day smoothed.
  const addrSma = ctx.data('addr_sma30');
  if (addrSma == null) return null;
  const addrEma = ctx.state.addrEma;
  const ema90 = addrEma == null ? addrSma : 0.011 * addrSma + 0.989 * addrEma; // ~90-day EMA
  ctx.state.addrEma = ema90;

  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  const ema20prev = ctx.ema(20, 2);
  if (sma200 == null || sma200prev == null || ema20 == null || ema20prev == null) return null;

  const addrGrowing = addrSma > ema90;       // sustained network growth
  const uptrend = sma200 > sma200prev;        // price in established uptrend
  const fastMomentum = ema20 > ema20prev;     // short-term price momentum rising

  if (pos > 0) {
    // Exit when network growth fades AND short-term momentum is NOT carrying the rally.
    if (!addrGrowing && !fastMomentum) {
      ctx.state.cooldown = ctx.i + 20;        // 20-bar cooldown to stop churn
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: ema20, trigger: 'below', note: 'momentum break', conds: [{ label: 'addr growth fading', ok: !addrGrowing }] }]);
    return null;
  }

  if (ctx.state.cooldown != null && ctx.i < ctx.state.cooldown) {
    ctx.watch([{ side: 'buy', at: ctx.state.cooldown * 86400000, note: 'cooldown ends' }]);
    return null;
  }

  if (addrGrowing && uptrend) {
    const qty = (ctx.cash / price) * 0.95;
    ctx.watch([{ side: 'sell', price: ema20, trigger: 'below', note: 'momentum break', conds: [{ label: 'addr growth fading', ok: !addrGrowing }] }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: '200d uptrend', conds: [{ label: 'addr growth', now: addrSma, op: '>', ref: ema90, closed: true }] }]);
  return null;
}
