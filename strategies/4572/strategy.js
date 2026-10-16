/*
 * @coinsori-strategy v1
 * name: FearGreed Contrarian v2 (panic dip in uptrend)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index is a crowd-sentiment gauge.
 * This is the CONTRARIAN bet — buy the panic, sell the euphoria. But a panic
 * is only a buying opportunity when the long-term trend is still up: in a bear
 * market the index can sit in extreme fear for months while prices keep
 * falling. So we buy extreme fear ONLY when price is above its 200-day average
 * (a bull-market dip, e.g. 2020-03, 2021-05), and sell when the crowd turns
 * greedy (index >= 60) or on a hard stop.
 * When it buys and sells: on each asset, buy when Fear & Greed <= 20 AND price
 * is above its 200-day average. Sell when it reaches 60 or price drops 30%
 * below entry.
 * When it does NOT work: in a violent crash the 200-day filter is slow and may
 * still be above price when the trend has already broken — those entries are
 * falling knives. It also sits out of the entire bear market (no shorting), and
 * the 30% stop turns a deep bull-market dip into a realized loss.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // ctx.data returns strings — coerce to number.
  const fg = Number(ctx.data('fg'));
  if (!Number.isFinite(fg)) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 30% hard stop: caps the loss on any single position.
      if (price <= entry * 0.70) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.70, trigger: 'below', note: 'stop: -30%' }]);
    }
    if (fg >= 60) return { side: 'sell', qty: pos }; // greed reached -> bank it
    return null;
  }

  // Trend context: only buy panic inside a long-term uptrend (closed bar).
  // Without this the 2018/2022 bears made every fear entry a falling knife.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  if (fg <= 20 && price > sma200) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  // Declare what we are waiting for so the run card shows it.
  ctx.watch([{
    side: 'buy',
    price: Math.max(sma200, price),
    trigger: 'below',
    note: 'enter: extreme fear <=20 in uptrend',
    conds: [{ label: 'F&G index', now: fg, op: '<=', ref: 20, closed: true },
           { label: 'Price > SMA200', ok: price > sma200 }]
  }]);
  return null;
}
