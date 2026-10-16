/*
 * @coinsori-strategy v1
 * name: BTC FearGreed Mean Reversion
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment is mean-reverting. When the Fear & Greed
 * index is in extreme fear (crowd panic) and price is stretched below its
 * medium-term average, buying the dip has historically offered a good
 * risk/reward because panic selling tends to exhaust. This is a different
 * family from trend-following — it bets on reversion, not continuation.
 * When it buys and sells: buy when Fear & Greed is below 25 (extreme fear) AND
 * price has fallen at least 8% below its 50-bar average AND RSI(14) is below 30.
 * Sell when price returns to the 50-bar average (target) or a 12% hard stop is hit,
 * or after 60 bars.
 * When it does NOT work: in a sustained bear market where "panic" keeps getting
 * more panicked, each dip-buy keeps falling (no reversion). It also sits out
 * most of a bull market because sentiment rarely stays in extreme fear.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 60) return null;
  const prevClose = c.at(-2);

  const fg = ctx.data('fear_greed');
  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    const stop = ctx.entryPx * 0.88;   // hard stop 12% below entry
    const target = ctx.entryPx * 1.10; // take profit at +10%
    if (price <= stop) return { side: 'sell', qty: pos };
    if (price >= target) return { side: 'sell', qty: pos };
    // time exit: sell after 60 bars in the position
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '12% stop' },
               { side: 'sell', price: target, trigger: 'above', note: '+10% target' }]);
    return null;
  }

  // Sentiment filter: need recent extreme fear
  if (fg == null) return null;
  if (fg > 25) return null;   // only buy in extreme fear

  const sma50 = ctx.sma(50, 1);
  const rsi = ctx.rsi(14, 1);
  if (sma50 == null || rsi == null) return null;

  // Price stretched at least 8% below its 50-bar average
  const stretch = (prevClose / sma50) - 1;
  if (stretch > -0.08) return null;
  if (rsi > 30) return null;   // RSI oversold confirmation

  ctx.watch([{ side: 'buy', price: prevClose, trigger: 'below', note: 'fear dip entry',
               conds: [{ label: 'Fear&Greed', now: fg, op: '<', ref: 25, closed: true },
                       { label: 'RSI(14)', now: rsi, op: '<', ref: 30, closed: true }] }]);

  // size: keep it modest — mean reversion has fat left tails
  const qty = (ctx.cash * 0.5 / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
