/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: The Fear & Greed index (0=extreme fear, 100=extreme greed) measures crowd emotion.
 * Crowds are usually wrong at the extremes, so buying when everyone is terrified and selling
 * when everyone is euphoric is a mean-reversion edge — a different family than trend-following
 * and funding, both of which have failed on BTC 4h in this job. The buy is only taken inside
 * an uptrend (price above the 200-bar SMA) so a fear spike during a bear market is not bought
 * as a falling knife.
 * When it buys/sells: buy (full position) when the index is <= 30 AND price is above the 200-SMA;
 * sell everything when it reaches >= 70, or stop out at 3xATR below entry. One position at a
 * time, with a 2-day cooldown after any exit.
 * When it fails: in a smooth one-way bull market it sells at greed and misses the rest of the
 * rally (underperforms buy-and-hold); if the 200-SMA lags a sudden top it can still buy one
 * late fear dip before the trend turns. It is a mean-reversion bet, not a trend bet.
 */

function onUpdate(ctx) {
  const close = ctx.closes.at(-2);
  if (close == null) return null;

  const fg = ctx.data("main.fear_greed");
  if (fg == null) { ctx.watch([]); return null; }   // sentiment data not available yet

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  const pos = ctx.position || 0;
  const inLong = pos > 1e-9;
  const entryPx = ctx.entryPx;
  const stopDist = 3 * atr;   // 3xATR stop: room for normal noise, caps a wrong fear bet

  // ---- exits ----
  if (inLong) {
    const stop = (entryPx == null ? close : entryPx) - stopDist;
    if (fg >= 70) {
      ctx.watch([{ side:'sell', price: close, trigger:'below', note:'F&G greed take-profit',
        conds:[{label:'Fear&Greed', now:fg, op:'>=', ref:70, closed:true}] }]);
      ctx.state.lastExitBar = ctx.i;
      return { side:'sell', qty: pos, reduceOnly:true };
    }
    if (close < stop) {
      ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'stop 3xATR' }]);
      ctx.state.lastExitBar = ctx.i;
      return { side:'sell', qty: pos, reduceOnly:true };
    }
    ctx.watch([
      { side:'sell', price: stop, trigger:'below', note:'stop 3xATR' },
      { side:'sell', price: close, trigger:'below', note:'F&G greed take-profit',
        conds:[{label:'Fear&Greed', now:fg, op:'>=', ref:70, closed:true}] }
    ]);
    return null;
  }

  // ---- entries (flat) ----
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';
  if (!allocOk) { ctx.watch([]); return null; }

  const lastExit = ctx.state.lastExitBar == null ? -1e9 : ctx.state.lastExitBar;
  if (ctx.i - lastExit < 12) { ctx.watch([]); return null; }   // 2-day cooldown: no instant re-entry after a stop

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) { ctx.watch([]); return null; }

  if (fg <= 30 && close > sma200) {   // fear dip inside an uptrend only — skip bear-market knives
    const qty = (ctx.cash / close) * 0.99;   // full position on a high-conviction fear entry
    ctx.watch([{ side:'buy', price: close, trigger:'above', note:'F&G fear entry in uptrend',
      conds:[{label:'Fear&Greed', now:fg, op:'<=', ref:30, closed:true},
             {label:'close>SMA200', ok: close > sma200, closed:true}] }]);
    return { side:'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
