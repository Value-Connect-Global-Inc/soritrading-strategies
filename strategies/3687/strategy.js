/*
 * @coinsori-strategy v1
 * name: FearGreedContrarian
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the crypto Fear & Greed index measures crowd emotion.
 * Extreme fear (index < 25) inside an uptrend has historically marked local
 * capitulation bottoms — a good contrarian entry; extreme greed (index > 80)
 * has marked euphoric tops — a good exit. It is a sentiment edge, a different
 * family from the Donchian breakout champion.
 * When it buys and sells: buy when the Fear & Greed index is below 25 AND the
 * price is above its 200-day average AND RSI(14) is below 40; sell when the
 * index rises above 80, or the price falls below its 200-day average, or a
 * 2x ATR stop below entry is hit.
 * When it does NOT work: in a long bear market price stays below the 200-day
 * average so it never buys (safe but flat); extreme fear can also be the start
 * of a deeper crash, so the hard stop is essential. If the sentiment feed is
 * late or missing it cannot trade at all.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }
  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  const fg = ctx.data('fear_greed');
  if (sma200 == null || rsi == null || atr == null || atr <= 0 || fg == null) return null;

  const pos = ctx.pos(ctx.sym);
  const qty = (ctx.cash / price) * 0.7; // 70% of equity per position; cash buffer caps drawdown

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    // Exit on euphoria (FG>80), a broken uptrend, or the protective stop.
    if (price <= hardStop || price < sma200 || fg > 80) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'uptrend broke',
                 conds: [{ label: 'Fear&Greed', now: fg, op: '>', ref: 80, closed: true }] }]);
    return null;
  }

  // Contrarian entry: extreme fear + uptrend + oversold, all from closed bars
  // so backtest, paper and live agree. Thresholds are the standard FG bands.
  if (fg < 25 && price > sma200 && rsi < 40) {
    ctx.watch([]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend + fear entry',
               conds: [{ label: 'Fear&Greed', now: fg, op: '<', ref: 25, closed: true },
                       { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }] }]);
  return null;
}
