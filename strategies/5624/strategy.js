/*
 * @coinsori-strategy v1
 * name: BTC 1D RSI-BB Mean Reversion
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the opposite of trend-following — after sharp panic selloffs
 * (oversold RSI, close below the lower Bollinger band, heavy volume) BTC tends to
 * bounce back toward its average. We bet on that bounce, but only inside an uptrend.
 * When it buys and sells: buys when RSI(14) is oversold (<30), price closes below the
 * lower BB(20,2) with above-average volume, and price is still above the 200-day
 * average (uptrend). Sells when RSI recovers above 55 or price closes above the
 * 20-day average; a -8% hard stop cuts a failed bounce early.
 * When it does NOT work: strong bear markets (dips below the SMA200 are filtered, but
 * a fast crash can gap through the stop) and sustained melt-ups where there are no
 * dips to buy — it sits in cash during the best rallies.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const sma20 = ctx.sma(20, 1);
  if (sma200 == null || sma20 == null) return null;

  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  if (rsi == null || bb == null || bb.lower == null) return null;

  const avgV = ctx.avgVol(30);
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 && ctx.vol > avgV;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    const stop = st.stop;
    const low = ctx.low(0);
    const watchArr = [
      { side: 'sell', price: sma20, trigger: 'above', note: 'Revert to SMA20', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 55, closed: true }] }
    ];
    if (stop != null) watchArr.push({ side: 'sell', price: stop, trigger: 'below', note: 'Hard stop -8%' });
    ctx.watch(watchArr);
    if (rsi > 55 || price > sma20) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (stop != null && low < stop) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const oversold = rsi < 30; // classic oversold threshold
  const belowLower = price < bb.lower;
  const uptrend = price > sma200; // only buy dips in a long-term uptrend, no knife-catching in bears
  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower dip', conds: [
      { label: 'RSI(14) oversold', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'Uptrend P>SMA200', ok: uptrend },
      { label: 'Vol > avg30', ok: volOk }
    ]}
  ]);
  if (oversold && belowLower && uptrend && volOk && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    ctx.state.stop = price * 0.92; // 8% hard stop caps a failed bounce
    return { side: 'buy', qty: ctx.cash / price * 0.6 };
  }
  return null;
}
