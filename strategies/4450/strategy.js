/*
 * @coinsori-strategy v1
 * name: Multi-Asset Defensive Mean-Reversion Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In a strong uptrend, sharp sell-offs (flush candles) tend to
 * snap back — dips get bought. This strategy buys those oversold dips inside a
 * rising 200-day trend and sells once price recovers, instead of chasing breakouts.
 * It is the mean-reversion counterpart to the momentum champion: it sits in cash
 * during bear markets (rising-trend gate) and only buys when the trend is intact.
 * When it buys and sells: on each asset, buy when the last closed bar closes below the
 * lower Bollinger band (20,2) with RSI(14)<30 (flush), OR below the Keltner low
 * (20-day EMA minus 2.5×ATR) with RSI(14)<40 (pullback) — only while the close is above
 * the 200-day EMA. Sell when the close recovers above the 20-day EMA, RSI rises above 55,
 * or a 20% hard stop is hit.
 * When it does NOT work: in a straight-line melt-up it buys few dips and lags buy-and-hold;
 * in a choppy sideways market the trend gate lets it in but the snap-back exit whipsaws;
 * in a broad bear the gate keeps it flat, so it misses nothing but also earns nothing.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;
  const c = ctx.closes;
  if (c.length < 2) return null;
  const prevClose = c.at(-2);
  if (prevClose == null || prevClose <= 0) return null;

  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const atr = ctx.atr(14, 1);
  const ema20 = ctx.ema(20, 1);

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.8;   // 20% hard stop: MR entries are oversold, give room
    if (price <= stop) return { side: 'sell', qty: pos };
    if (ema20 != null && prevClose > ema20) return { side: 'sell', qty: pos };   // recovered
    if (rsi != null && rsi > 55) return { side: 'sell', qty: pos };              // no longer oversold
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '20% stop' },
               { side: 'sell', price: ema20 != null ? ema20 : price, trigger: 'above', note: 'recovered to 20d EMA' }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  if (!uptrend) {
    ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'trend up again',
                 conds: [{ label: 'close > 200d EMA', ok: false, closed: true }] }]);
    return null;
  }

  // entry: flush (BB lower + RSI<30) OR pullback (Keltner low + RSI<40)
  let buy = false;
  let entryNote = '';
  if (bb && bb.lower != null && rsi != null && prevClose < bb.lower && rsi < 30) {
    buy = true; entryNote = 'BB lower flush';
  } else if (ema20 != null && atr != null && rsi != null && prevClose < (ema20 - 2.5 * atr) && rsi < 40) {
    buy = true; entryNote = 'Keltner pullback';
  }
  if (!buy) {
    const lvl = (bb && bb.lower != null) ? bb.lower : (ema20 != null && atr != null ? ema20 - 2.5 * atr : null);
    ctx.watch([{ side: 'buy', price: lvl != null ? lvl : price, trigger: 'below', note: 'oversold dip',
                 conds: [{ label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true },
                         { label: 'close > 200d EMA', ok: uptrend, closed: true }] }]);
    return null;
  }

  const qty = (ctx.cash * 0.33 / price) * 0.95;   // 1/3 of pool per leg
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
