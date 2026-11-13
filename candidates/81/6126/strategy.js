/*
 * @coinsori-strategy v1
 * name: ETH Macro Risk-On 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto is a high-beta risk asset — it rallies while US equities are strong
 *   and crashes when fear spikes. A slow macro gate (NASDAQ-100 above its own 100-day average)
 *   keeps us long through the bull and steps aside through the bear. A crypto-specific trend
 *   filter (ETH above its 200-period EMA) cuts crashes that hit crypto even when equities stay
 *   strong. A wide 25% trailing stop caps deep crash drawdowns without firing on normal 4h noise.
 * When it buys and sells: It is long ETH while the NASDAQ-100 is not far below its 100-day
 *   average, the VIX is below 50, and ETH price is above its 200-period EMA. It exits when any
 *   gate fails or when price falls 25% from its best level since entry. Exits are reduceOnly.
 * When it does NOT work: The NDX data arrives with a 2-day lag, so sudden moves are seen late.
 *   In a long flat market the filters flip and churn fees. It is long-only, so it cannot profit
 *   from a short market.
 */

function onUpdate(ctx) {
  const s = ctx.state;
  if (!s.ndx) s.ndx = [];
  if (!s.vix) s.vix = [];

  const ndx = ctx.data('base.ndx');
  const vix = ctx.data('base.vix');
  const ethEma = ctx.ema(200, 1);
  if (ndx == null || vix == null || ethEma == null) { ctx.watch([]); return null; }

  if (s.ndx.length === 0 || ndx !== s.ndx[s.ndx.length - 1]) {
    s.ndx.push(ndx);
    if (s.ndx.length > 260) s.ndx.shift();
  }
  if (s.vix.length === 0 || vix !== s.vix[s.vix.length - 1]) {
    s.vix.push(vix);
    if (s.vix.length > 260) s.vix.shift();
  }

  const MA_N = 100;
  let ndxMa = null;
  if (s.ndx.length >= MA_N) {
    let sum = 0;
    for (let i = s.ndx.length - MA_N; i < s.ndx.length; i++) sum += s.ndx[i];
    ndxMa = sum / MA_N;
  }
  if (ndxMa == null) { ctx.watch([]); return null; }

  const riskOn = ndx > ndxMa * 0.97;   // stay in through shallow equity pullbacks inside a bull
  const panic = vix > 50;              // true-panic circuit breaker only
  const ethUp = ctx.closes.at(-2) > ethEma;   // crypto trend filter

  if (ctx.position > 0) {
    const entry = ctx.entryPx;
    if (entry == null) { ctx.watch([]); return null; }
    if (s.peak == null || ctx.price > s.peak) s.peak = ctx.price;
    const stop = Math.max(entry * 0.75, s.peak * 0.75);   // 25% hard floor from entry, 25% trail from peak
    const stopped = ctx.price < stop;

    ctx.watch([
      { side: 'sell', price: ndxMa * 0.97, trigger: 'below', note: 'NDX<100dMA risk-off', conds: [{ label: 'VIX', now: vix, op: '<', ref: 50, closed: true }] },
      { side: 'sell', price: 50, trigger: 'above', note: 'VIX panic exit' },
      { side: 'sell', price: ethEma, trigger: 'below', note: 'ETH<200EMA exit', conds: [{ label: 'ETH>200EMA', ok: ethUp, closed: true }] },
      { side: 'sell', price: stop, trigger: 'below', note: '25% trailing stop' }
    ]);

    if (!riskOn || panic || !ethUp || stopped) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: ethEma, trigger: 'above', note: 'ETH>200EMA entry', conds: [{ label: 'NDX>100dMA', ok: riskOn, closed: true }, { label: 'VIX<50', ok: !panic, closed: true }] }
  ]);

  if (riskOn && !panic && ethUp) {
    s.peak = null;
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
