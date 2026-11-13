/*
 * @coinsori-strategy v1
 * name: BTC 4H Trend + USD-Regime Filter
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC is priced in US dollars, so an extreme dollar spike (Fed broad index more
 * than ~1.5 std dev above its 1-year mean, e.g. the COVID crash and the 2022 bear) historically
 * drags crypto down hard. We ride BTC up-trends but step aside during those extreme dollar spikes.
 * When it buys and sells: Buy whenever the trend regime is up (50-bar EMA above the 200-bar EMA on
 * a closed bar) while the broad dollar index is not more than 1.5 std dev above its 1-year mean.
 * Sell when the 50-bar EMA crosses back below the 200-bar EMA, or when price falls below a 10-ATR
 * trailing stop.
 * When it does NOT work: In choppy sideways markets the trend filter whipsaws (frequent small
 * buy/sell pairs), and the dollar filter adds nothing if crypto rallies in spite of a strong dollar.
 */
function onUpdate(ctx) {
  // ---- USD regime: z-score of broad dollar index vs its trailing ~1y window ----
  const usd = ctx.data("base_usd_broad");
  if (usd == null) return null;

  let win = ctx.state.usdWin || [];
  if (win[win.length - 1] !== usd) {
    win.push(usd);
    if (win.length > 250) win = win.slice(-250);
    ctx.state.usdWin = win;
  }
  if (win.length < 120) return null; // need ~6 months of daily observations for a stable mean

  let sum = 0;
  for (const v of win) sum += v;
  const mean = sum / win.length;
  let ss = 0;
  for (const v of win) ss += (v - mean) * (v - mean);
  const sd = Math.sqrt(ss / win.length) || 1e-9;
  const usdZ = (usd - mean) / sd;

  // ---- Trend regime on closed bars (ago>=1 so backtest == live) ----
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  if (ema50 == null || ema200 == null) return null;

  const atr = ctx.atr(14, 1);
  const price = ctx.price;
  const inPos = ctx.position > 0;
  const stop = ctx.state.stop || 0;

  // Regime is up when the 50 EMA sits above the 200 EMA on a closed bar.
  const regimeUp = ema50 > ema200;

  // ---- Watch declarations (required every tick) ----
  const watch = [];
  if (!inPos) {
    watch.push({
      side: 'buy', price: price, trigger: 'above', note: 'Regime up + USD ok',
      conds: [
        { label: 'EMA50>EMA200', ok: regimeUp, closed: true },
        { label: 'USD z<1.5', ok: usdZ < 1.5 }
      ]
    });
  } else {
    watch.push({ side: 'sell', price: stop, trigger: 'below', note: '10-ATR trailing stop' });
    watch.push({ side: 'sell', price: ema200, trigger: 'below', note: 'Trend break exit' });
  }
  ctx.watch(watch);

  // ---- Exit logic ----
  if (inPos) {
    const orders = [];
    // Ratchet the trailing stop up with price (10 ATR below close). 10 ATR ~ 20% of price in a hot
    // bull: wide enough to survive normal 15-25% bull pullbacks, tight enough to cut real reversals.
    if (atr != null) {
      const newStop = price - 10 * atr;
      if (newStop > stop) ctx.state.stop = newStop;
    }
    // Trend break: regime turned down on a closed bar
    if (!regimeUp) {
      orders.push({ side: 'sell', qty: ctx.position, reduceOnly: true });
    }
    // Trailing stop hit
    if (ctx.state.stop > 0 && price < ctx.state.stop) {
      orders.push({ side: 'sell', qty: ctx.position, reduceOnly: true });
    }
    return orders.length ? orders : null;
  }

  // ---- Entry: any time the regime is up, unless the dollar is spiking ----
  if (regimeUp && usdZ < 1.5) {
    ctx.state.stop = 0;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }

  return null;
}
