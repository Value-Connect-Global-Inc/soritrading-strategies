/*
 * @coinsori-strategy v1
 * name: BTC Turtle TrendFilter VIX 1D
 * interval: 1d
 * ex: binance
 * syms: BTC/USDT
 * cash: 10000
 *
 * Why this strategy: A plain turtle fails in bear markets because short-side breakouts whipsaw. This
 * version only takes LONG breakouts when the 200-day trend is already up — a fresh 55-day high in an
 * uptrend is a real continuation, not a bear rally. Full investment fixes under-sizing. A VIX spike
 * above 40 is an escape hatch to cash that cuts a crash short before the 20-day exit triggers.
 * When it buys and sells: Buy with ~95% of cash when price closes above the 55-day high AND the
 * 200-day average is rising. Sell all when price closes below the 20-day low, or immediately when the
 * VIX spikes above 40 (panic — get out, re-enter only on a fresh breakout in a rising trend).
 * When it does NOT work: In a long sideways market, 55-day breakouts in a barely-rising trend fail
 * repeatedly. It lags buy-and-hold in a smooth relentless bull because it exits pullbacks and
 * re-enters on a fresh high. It does not short, so it sits out bears.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const hi55 = ctx.high(55, 1);
  const lo20 = ctx.low(20, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const vix = ctx.data('base_vix'); // CBOE VIX, daily, lag 2d
  if (hi55 == null || lo20 == null || sma200 == null || sma200prev == null) return null;
  const trendUp = sma200 > sma200prev;
  const panic = (vix != null && vix > 40); // extreme market panic, exit to cash

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: lo20, trigger: 'below', note: '20-day low exit' },
      { side: 'sell', price: 40, trigger: 'above', note: 'VIX panic exit', conds: [
        { label: 'VIX', now: vix, op: '>', ref: 40, closed: true }
      ]}
    ]);
    if (price < lo20 || panic) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: '55-day breakout in uptrend', conds: [
    { label: 'SMA200 rising', ok: trendUp },
    { label: 'VIX calm', ok: !panic }
  ]}]);
  if (trendUp && price > hi55 && !panic) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
