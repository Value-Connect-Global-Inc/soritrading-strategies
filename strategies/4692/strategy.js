/*
 * @coinsori-strategy v1
 * name: BTC BuyTheDip 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a confirmed uptrend (price above a rising 200-SMA), short pullbacks are buying opportunities — the trend resumes. This is the opposite family from the breakout turtle: it buys dips instead of breakouts, and unlike pure mean reversion it only trades inside an uptrend so it does not catch falling knives.
 * When it buys and sells: buy when price is above a rising 200-SMA, RSI(14) pulled back below 45, and the close crosses back above the 20-EMA (dip over). Sell when RSI(14) reaches 70 (overbought), the close drops below the 50-SMA (trend broken), or price hits a 2.5x ATR stop.
 * When it does NOT work: in a choppy sideways market the 200-SMA is flat and dips keep going down; in a downtrend it simply stays in cash (no short side).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 260) return null;
  const prevClose = c.at(-2);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);
  const sma50 = ctx.sma(50, 1);
  const ema20 = ctx.ema(20, 1);
  const ema20Prev = ctx.ema(20, 2);
  const rsi = ctx.rsi(14, 1);
  const rsiPrev = ctx.rsi(14, 2);

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2.5;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (rsi != null && rsi >= 70) return { side: 'sell', qty: pos };
    if (sma50 != null && prevClose < sma50) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: sma50, trigger: 'below', note: '50-SMA breakdown' }]);
    return null;
  }

  if (sma200 == null || sma200Prev == null || ema20 == null || ema20Prev == null) return null;
  if (rsi == null || rsiPrev == null) return null;
  if (!(prevClose > sma200)) return null;         // uptrend context
  if (!(sma200 > sma200Prev)) return null;        // 200-SMA rising
  if (!(rsiPrev < 45)) return null;               // was a dip
  if (!(prevClose > ema20 && prevClose <= ema20Prev + (ema20 - ema20Prev) * 0.5)) {
    // fall through to plain recross check below
  }
  if (!(prevClose > ema20 && prevClose <= ema20Prev + (ema20 - ema20Prev))) {
    // no recross — wait
  }
  // recross: previous close below EMA20, current close above EMA20
  const prevBelow = c.at(-3) <= ema20Prev;
  const nowAbove = prevClose > ema20;
  if (!(prevBelow && nowAbove)) return null;

  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: ema20, trigger: 'above', note: '20-EMA recross',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true },
                       { label: 'RSI(14) prev', now: rsiPrev, op: '<', ref: 45, closed: true },
                       { label: 'price > SMA200', ok: prevClose > sma200, closed: true }] }]);
  return { side: 'buy', qty };
}
