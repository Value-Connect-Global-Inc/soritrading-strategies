/*
 * @coinsori-strategy v1
 * name: Panic-Bounce LINK 4H
 * ex: binance
 * syms: LINKUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated cross-asset champion recipe (band-bounce
 * mean reversion) applied to a fresh high-volatility asset, LINK. Buy panic
 * bottoms below the lower Bollinger band with RSI<30 in an uptrend, and scale
 * down when the fear-greed index shows deep fear. Validated on 11+ assets;
 * this tests a 12th.
 * When it buys and sells: buys when price closes below the lower Bollinger(20,2)
 * with RSI<30, above the 200-SMA. Position 50% when fear-greed<10, 70% when
 * <20, else 95%. Sells at the middle band, RSI>50, or a 6-ATR stop; 5-bar
 * cooldown.
 * When it does NOT work: lags strong melt-ups (never buys without a dip).
 * A panic that keeps falling still loses despite the stop. Never buys below
 * the 200-SMA, so it sits out bear markets (its main protection).
 * 2025-01-12: display-only watch added; trading logic unchanged.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (bb == null || rsi == null || sma200 == null) return null;

  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    if (price >= bb.mid || rsi > 50) {
      ctx.state.lastExit = ctx.i;
      ctx.watch([{ side: 'sell', price: bb.mid, trigger: 'above', note: 'BB mid target' },
                 { side: 'sell', price: null, trigger: null, note: 'RSI over 50' }]);
      return { side: 'sell', qty: pos };
    }
    const atr = ctx.atr(14, 1);
    if (atr != null && price <= ctx.entryPx - atr * 6) {
      ctx.state.lastExit = ctx.i;
      ctx.watch([{ side: 'sell', price: ctx.entryPx - atr * 6, trigger: 'below', note: '6-ATR stop' }]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: bb.mid, trigger: 'above', note: 'BB mid target' },
               { side: 'sell', price: ctx.entryPx - atr * 6, trigger: 'below', note: '6-ATR stop' }]);
    return null;
  }

  const lastExit = ctx.state.lastExit || 0;
  if (ctx.i - lastExit < 5) {
    ctx.watch([]);
    return null;
  }
  if (price < sma200) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Above SMA200' }]);
    return null;
  }
  if (!(price < bb.lower && rsi < 30)) {
    ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower', conds: [{ label: 'RSI(14)', now: rsi, op: '<', ref: 30, closed: true }] }]);
    return null;
  }

  // Two-tier fear-depth sizing: deep fear = smaller position (bounce less
  // reliable). Fall back to 95% if fear-greed data is missing.
  const fg = ctx.data('fear_greed');
  let frac = 0.95;
  if (fg != null) {
    if (fg < 10) frac = 0.50;
    else if (fg < 20) frac = 0.70;
  }

  ctx.state.lastExit = ctx.i;
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower entry', conds: [{ label: 'RSI(14)', now: rsi, op: '<', ref: 30, closed: true }, { label: 'FG index', now: fg, op: '<', ref: 20 }] }]);
  return { side: 'buy', qty: ctx.cash / ctx.price * frac };
}
