/*
 * @coinsori-strategy v1
 * name: ETH Donchian Turtle 1D
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: classic turtle trend-following — a breakout above the
 * 20-day highest high signals the start of a new up-leg that tends to persist
 * in ETH's volatile bull runs. The 200-day average is a regime filter that
 * keeps the system out of long bear markets.
 * When it buys and sells: buys when price closes above its 20-day high AND is
 * above its 200-day average; sells when price closes below its 10-day low OR
 * drops more than 2.5x ATR(14) from its peak (a trailing stop that caps loss).
 * When it does NOT work: in choppy sideways markets the 20-day breakout
 * whipsaws (buy the top, sell the bottom); the 200-day filter is slow so the
 * first leg of a crash is taken before it exits.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const dc20 = ctx.donchian(20, 1);
  const dc10 = ctx.donchian(10, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || dc20 == null || dc10 == null || atr == null) return null;

  const pos = ctx.position;
  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  // Trailing peak (restart-safe, kept in ctx.state).
  let peak = st.peak || 0;
  if (pos > 0 && price > peak) peak = price;
  ctx.state.peak = peak;

  if (pos > 0) {
    const stop = Math.max(dc10.lower, peak - 2.5 * atr);
    ctx.watch([
      { side: 'sell', price: dc10.lower, trigger: 'below', note: '10d Donchian exit' },
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR trailing stop' }
    ]);
    if (price < stop && cd === 0) {
      ctx.state.cd = 3;
      ctx.state.peak = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const breakout = price > dc20.upper;
  const regime = price > sma200;
  ctx.watch([
    { side: 'buy', price: dc20.upper, trigger: 'above', note: '20d breakout entry', conds: [
      { label: 'Price > SMA200', ok: regime }
    ]}
  ]);
  if (breakout && regime && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 3;
    ctx.state.peak = price;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
