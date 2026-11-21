/*
 * @coinsori-strategy v1
 * name: ETH USD-Regime LongShort 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: Crypto is priced in dollars and historically falls when the US dollar strengthens (risk-off) and rises when the dollar is weak. This strategy uses the Fed's broad dollar index as a slow risk-on/risk-off filter and trades BOTH sides on a perpetual: it buys ETH when the dollar is weak and the trend is up, and shorts it when the dollar is strong and the trend is down, so it can profit in falling periods instead of just sitting out.
 * When it buys and sells: Buys when the dollar is below its recent mean (weak) and price is above its 200-bar average; shorts when the dollar is clearly strong and price is below its 200-bar average; exits on a wide ATR trailing stop or when the regime flips against the position.
 * When it does NOT work: In a sideways market with a neutral dollar it alternates small long/short attempts and pays fees. The dollar index has about a 10-day publication lag, so a sudden dollar spike is seen late. Shorting while crypto decouples from the dollar (strong dollar but crypto rallying) loses.
 */
function onUpdate(ctx) {
  const usd = ctx.data("base_usd_broad");
  if (usd == null) { ctx.watch([]); return null; }
  const hist = ctx.state.usdHist || [];
  hist.push(usd);
  if (hist.length > 800) hist.shift();
  ctx.state.usdHist = hist;
  if (hist.length < 200) { ctx.watch([]); return null; }
  let mean = 0;
  for (let i = 0; i < hist.length; i++) mean += hist[i];
  mean /= hist.length;
  let v = 0;
  for (let i = 0; i < hist.length; i++) v += (hist[i] - mean) * (hist[i] - mean);
  v /= hist.length;
  const sd = Math.sqrt(v);
  if (sd < 1e-9) { ctx.watch([]); return null; }
  const z = (usd - mean) / sd;

  const price = ctx.price;
  const sma = ctx.sma(200);
  const atr = ctx.atr(14);
  if (sma == null || atr == null) { ctx.watch([]); return null; }
  const pos = ctx.position || 0;
  const inCooldown = ctx.state.cooldown && ctx.i < ctx.state.cooldown;

  if (pos > 0) {
    const hi = Math.max(ctx.state.hi || price, price);
    ctx.state.hi = hi;
    const stop = hi * (1 - (5 * atr) / price); // 5xATR: wide enough for 4h noise, tight enough to lock gains
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR trailing stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'risk-off exit',
        conds: [{ label: 'USD strong z>0.5', ok: z > 0.5 }] }
    ]);
    if (price <= stop || z > 0.5) {
      ctx.state.hi = null;
      ctx.state.cooldown = ctx.i + 24; // 4 days before re-entering after exit
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (pos < 0) {
    const lo = Math.min(ctx.state.lo || price, price);
    ctx.state.lo = lo;
    const stop = lo * (1 + (5 * atr) / price);
    ctx.watch([
      { side: 'buy', price: stop, trigger: 'above', note: 'ATR trailing stop' },
      { side: 'buy', price: price, trigger: 'above', note: 'risk-on exit',
        conds: [{ label: 'USD weak z<-0.5', ok: z < -0.5 }] }
    ]);
    if (price >= stop || z < -0.5) {
      ctx.state.lo = null;
      ctx.state.cooldown = ctx.i + 24;
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    return null;
  }

  ctx.state.hi = null;
  ctx.state.lo = null;
  if (inCooldown) { ctx.watch([]); return null; }
  if (z < -0.5 && price > sma) {
    ctx.state.hi = price;
    ctx.state.cooldown = null;
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'trend up entry',
      conds: [{ label: 'USD weak z<-0.5', ok: z < -0.5 }] }]);
    return { side: 'buy', qty: ctx.cash / price * 0.98 };
  }
  if (z > 0.5 && price < sma) {
    ctx.state.lo = price;
    ctx.state.cooldown = null;
    ctx.watch([{ side: 'sell', price: sma, trigger: 'below', note: 'trend down entry',
      conds: [{ label: 'USD strong z>0.5', ok: z > 0.5 }] }]);
    return { side: 'sell', qty: ctx.cash / price * 0.98 };
  }
  ctx.watch([]);
  return null;
}
