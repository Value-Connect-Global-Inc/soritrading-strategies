/*
 * @coinsori-strategy v1
 * name: BTC Trend Regime SMA200 + Intra-Bar Stop 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC alternates between long trending regimes; the 200-bar SMA
 * separates them. We stay long only while price is clearly above it, so we ride
 * up-trends and step aside in down-trends. The worst drawdown in earlier versions
 * came from a single position riding a crash down: exits only fire on a closed bar,
 * so a fast crash gaps through the stop and fills at the crashed close. This
 * version places the protective stop as an intra-bar stop order (type 'smart' +
 * trigger) so it fills AT the level, genuinely capping the loss on every position.
 * Position size is capped at 85% of cash so no single regime can ruin the account.
 * When it buys: last closed bar closes >2% above SMA200, SMA200 rising, size
 * shrinks further as ATR14/ATR60 grows.
 * When it sells: intra-bar stop at max(5xATR trail after 8% profit, SMA200-2%,
 * hard stop 10% below entry), plus closed-bar exits for trend slope down and
 * panic vol spike.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);
  if (sma200 == null || sma200Prev == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const atr14 = ctx.atr(14, 1);
  const atr60 = ctx.atr(60, 1);
  const pos = ctx.position || 0;
  const price = ctx.price;
  const buyBand = sma200 * 1.02;
  const sellBand = sma200 * 0.98;
  const trendDown = sma200 < sma200Prev;

  if (pos > 0) {
    const entry = ctx.entryPx;
    let peak = ctx.state.peak || 0;
    if (prevClose > peak) peak = prevClose;
    ctx.state.peak = peak;

    let trail = null;
    // arm only after a clear 8% profit so fresh-entry pullbacks never stop us out;
    // 5xATR is wide enough to survive normal bull-run pullbacks (judgement)
    if (atr14 != null && entry != null && peak > entry * 1.08) {
      trail = peak - 5 * atr14;
    }
    const stop = (trail != null && trail > sellBand) ? trail : sellBand;
    // hard stop 10% below entry: caps catastrophic trades in every regime
    const hardStop = entry != null ? entry * 0.90 : null;

    let panic = false;
    if (atr14 != null && atr60 != null && atr60 > 0 && atr14 > 2.5 * atr60) {
      panic = true;
    }

    // highest protective level = tightest stop that is still relevant
    const stopLevel = Math.max(stop, hardStop != null ? hardStop : 0);

    ctx.watch([
      { side: 'sell', price: sellBand, trigger: 'below', note: 'trend breakdown' },
      { side: 'sell', price: stopLevel, trigger: 'below', note: 'intra-bar stop' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'trend slope down', conds: [{ label: 'SMA200 slope down', ok: trendDown, closed: true }] },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'panic vol spike', conds: [{ label: 'ATR14 > 2.5x ATR60', ok: panic, closed: true }] }
    ]);

    // 1) closed-bar conditions already met -> exit now at market
    if (prevClose < sellBand || trendDown || (trail != null && prevClose < trail) || panic) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // 2) otherwise hold, but keep a standing intra-bar stop that fills AT the level
    if (stopLevel > 0) {
      return { side: 'sell', qty: pos, type: 'smart', trigger: stopLevel, reduceOnly: true };
    }
    return null;
  }

  ctx.state.peak = 0;
  const trendUp = sma200 > sma200Prev;

  let volFactor = 1;
  if (atr14 != null && atr60 != null && atr60 > 0) {
    // cap at 0.85 (never bet more than 85% of cash) and shrink in high-vol regimes
    volFactor = Math.min(0.85, atr60 / atr14);
  }

  ctx.watch([{ side: 'buy', price: buyBand, trigger: 'above', note: 'uptrend confirmed' }]);
  if (prevClose > buyBand && trendUp) {
    const qty = (ctx.cash / price) * 0.99 * volFactor;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
