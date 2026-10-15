/*
 * @coinsori-strategy v1
 * name: FearGreed Contrarian BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC's biggest rallies historically start from extreme fear readings.
 *   Crowd panic marks a local bottom; buying panic with an uptrend intact rides the recovery.
 * When it buys and sells: Buys when Fear & Greed <= 20 AND price is above its 200-day average
 *   (uptrend intact, no falling knife in a bear). Sells when the index >= 80 (crowd greed),
 *   when price drops below the 200-day average (trend broken), or a -20% hard stop.
 * When it does NOT work: In a real bear (price already below 200-day) it never buys — it just
 *   stays flat, so it misses nothing but also makes nothing. If greed stays high for months
 *   (2021), it exits early and misses the top of the rally. It is a defensive, not aggressive,
 *   strategy.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  if (fg == null) return null; // sentiment data starts 2018-02; before that, stay out
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const price = ctx.price;

  if (ctx.position <= 0) {
    ctx.watch([{ side: 'buy', price: ctx.price, note: 'fg<=20 & above SMA200',
      conds: [{ label: 'Fear&Greed', now: fg, op: '<=', ref: 20, closed: true },
              { label: 'price>SMA200', ok: price > sma200 }] }]);
    if (fg <= 20 && price > sma200) {
      return { side: 'buy', qty: ctx.cash / price * 0.98 };
    }
    return null;
  }

  const entry = ctx.entryPx;
  if (entry == null) return null;
  const stop = entry * 0.80; // -20% hard stop: one losing trade cannot ruin the account
  const trendExit = price < sma200;
  ctx.watch([{ side: 'sell', price: Math.max(stop, sma200), trigger: 'below', note: 'stop / trend exit' },
             { side: 'sell', price: ctx.price, note: 'fg>=80 greed exit',
               conds: [{ label: 'Fear&Greed', now: fg, op: '>=', ref: 80, closed: true }] }]);
  if (fg >= 80 || trendExit || price <= stop) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
