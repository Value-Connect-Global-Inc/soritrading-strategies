/*
 * @coinsori-strategy v1
 * name: XRP 4H Pullback In Uptrend
 * ex: binance
 * syms: XRPUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: in crypto, strong uptrends keep making higher highs and the price
 * frequently dips back to the 20-bar average before resuming. Buying those shallow dips
 * with a tight stop and a 2xATR target catches the resumption while limiting risk.
 * When it buys and sells: buy only when the 50-bar trend is above the 200-bar trend and the
 * price has pulled back to the 20-bar average (RSI in the 35-60 pullback zone, not a crash).
 * Sell when the target (+2 ATR) or stop (-1.5 ATR) is hit, or when the trend turns down.
 * When it does NOT work: in choppy sideways markets the 20-bar average is crossed constantly
 * and stops get hit repeatedly; in fast crashes price gaps through the stop. Both lose.
 *
 * Date: 2025-01-XX — display only changed, trading logic unchanged.
 */

function onUpdate(ctx) {
  const ema20 = ctx.ema(20, 1);
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  if (ema20 == null || ema50 == null || ema200 == null || rsi == null || atr == null) return null;

  const st = ctx.state || {};
  const close = ctx.price;

  // ---- exits ----
  if (ctx.position > 0) {
    const stop = st.stopPx, tp = st.tpPx;
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'stop -1.5 ATR' },
      { side: 'sell', price: tp, trigger: 'above', note: 'target +2 ATR' },
      { side: 'sell', price: ema200, trigger: 'below', note: 'trend break', conds: [{ label: 'close < EMA200', now: close, op: '<', ref: ema200, closed: false }] }
    ]);
    // stop, target, or trend break all close the trade
    if (close <= stop || close >= tp || close < ema200) {
      ctx.state = { cooldown: ctx.i + 3 }; // 3-bar cooldown avoids instant re-entry
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  // ---- entry ----
  if (st.cooldown != null && ctx.i < st.cooldown) {
    ctx.watch([{ side: 'buy', at: ctx.candle.start + st.cooldown * ctx.candle.interval, note: 'cooldown ends' }]);
    return null;
  }

  const uptrend = ema50 > ema200;
  // dipped to the average but not crashed through it
  const pullback = close < ema20 && close > ema20 - atr;
  // pullback RSI zone: excludes both crashes (<35) and blowoffs (>60)
  const zone = rsi > 35 && rsi < 60;
  if (uptrend && pullback && zone) {
    const stop = close - 1.5 * atr;
    const tp = close + 2 * atr;
    // risk 1% of cash per trade so drawdown stays bounded
    const qty = Math.min((ctx.cash * 0.01) / (1.5 * atr), (ctx.cash / ctx.price) * 0.98);
    ctx.state = { stopPx: stop, tpPx: tp, cooldown: 0 };
    ctx.watch([
      { side: 'buy', price: close, trigger: 'below', note: 'pullback to EMA20', conds: [
        { label: 'uptrend', ok: uptrend },
        { label: 'pullback', ok: pullback },
        { label: 'RSI zone', now: rsi, op: '>', ref: 35, closed: true },
        { label: 'RSI < 60', now: rsi, op: '<', ref: 60, closed: true }
      ]},
      { side: 'sell', price: tp, trigger: 'above', note: 'target +2 ATR' },
      { side: 'sell', price: stop, trigger: 'below', note: 'stop -1.5 ATR' }
    ]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([
    { side: 'buy', price: ema20, trigger: 'below', note: 'pullback to EMA20', conds: [
      { label: 'uptrend', ok: uptrend },
      { label: 'RSI > 35', now: rsi, op: '>', ref: 35, closed: true },
      { label: 'RSI < 60', now: rsi, op: '<', ref: 60, closed: true }
    ]}
  ]);
  return null;
}
