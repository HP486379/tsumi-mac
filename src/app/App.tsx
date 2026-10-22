import { useEffect, useRef, useState } from "react";
import { Game, type Command, type Snapshot } from "../game/engine/Game";
import { draw } from "../game/rendering/canvas";
import { Sound } from "../game/systems/audio";
import {
  loadAudio,
  loadBest,
  saveAudio,
  saveBest,
} from "../game/systems/storage";
import { DEVICES, yen } from "../data/devices";
import { DeviceIcon } from "../components/DeviceIcon";
const time = (s: number) =>
  `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
export function App() {
  const gameRef = useRef<Game | null>(null);
  if (!gameRef.current) gameRef.current = new Game();
  const game = gameRef.current;
  const soundRef = useRef<Sound | null>(null);
  if (!soundRef.current) soundRef.current = new Sound();
  const sound = soundRef.current;
  const canvas = useRef<HTMLCanvasElement>(null),
    board = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<Snapshot>(() => game.snapshot());
  const [help, setHelp] = useState(false),
    [best, setBest] = useState(loadBest),
    [feedback, setFeedback] = useState("");
  const [audio, setAudio] = useState(loadAudio);
  const repeating = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRepeat = () => {
    if (repeating.current) {
      clearInterval(repeating.current);
      repeating.current = null;
    }
  };
  const publish = () => setState(game.snapshot());
  useEffect(() => {
    sound.effects = audio.effects;
    sound.music = audio.music;
    sound.sync();
    saveAudio(audio.effects, audio.music);
  }, [audio, sound]);
  useEffect(() => {
    game.onSound = (kind) => sound.effect(kind);
    let raf = 0,
      last = 0,
      accumulator = 0,
      lastPublish = 0;
    const ctx = canvas.current!.getContext("2d")!;
    const frame = (now: number) => {
      const delta = last ? Math.min(now - last, 100) : 0;
      last = now;
      if (game.status === "playing" && !document.hidden) {
        accumulator += delta;
        let steps = 0;
        while (accumulator >= 1000 / 60 && steps < 5) {
          game.step();
          accumulator -= 1000 / 60;
          steps++;
        }
        if (steps === 5) accumulator = 0;
      } else accumulator = 0;
      draw(ctx, game);
      if (now - lastPublish >= 100) {
        setState(game.snapshot());
        lastPublish = now;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const pause = () => {
      stopRepeat();
      if (game.status === "playing") {
        game.pause();
        setState(game.snapshot());
      }
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", pause);
    if (import.meta.env.MODE === "e2e")
      void import("../tests/browserHarness").then((m) => m.attachHarness(game));
    return () => {
      cancelAnimationFrame(raf);
      stopRepeat();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", pause);
      game.dispose();
      sound.dispose();
    };
  }, [game, sound]);
  useEffect(() => {
    sound.running = state.status === "playing";
    sound.sync();
    if (state.status !== "playing") stopRepeat();
    if (state.status === "over") {
      const next = Math.max(loadBest(), state.organized);
      setBest(next);
      if (!saveBest(next))
        setFeedback("記録を保存できませんでした。このタブでは保持します。");
    }
  }, [state.status, sound, state.organized]);
  useEffect(() => {
    const keys: Record<string, Command> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "rotate",
      x: "rotate",
      X: "rotate",
      z: "counterRotate",
      Z: "counterRotate",
      ArrowDown: "soft",
      " ": "drop",
    };
    const down = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches("button,textarea,input") &&
        (e.key === " " || e.key === "Enter")
      )
        return;
      if (help) {
        if (e.key === "Escape") setHelp(false);
        return;
      }
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        if (game.status === "playing" || game.status === "paused") {
          e.preventDefault();
          if (!e.repeat) {
            game.pause();
            publish();
          }
        }
        return;
      }
      if (keys[e.key] && game.status === "playing" && !help) {
        e.preventDefault();
        if (
          !e.repeat ||
          !["rotate", "counterRotate", "drop"].includes(keys[e.key])
        )
          game.command(keys[e.key]);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [game, help]);
  const start = () => {
    sound.unlock();
    stopRepeat();
    setFeedback("");
    setHelp(false);
    game.start();
    publish();
    board.current?.focus();
  };
  const togglePause = () => {
    sound.unlock();
    game.pause();
    publish();
    board.current?.focus();
  };
  const showHelp = () => {
    if (game.status === "playing") game.pause();
    publish();
    setHelp(true);
  };
  const shareText = `積みMac — STACK YOUR MAC\n資産整理 ${yen(state.organized)} / ${state.rows}行\n積みMac指数 ${yen(state.remaining)}\n起動したMac：0台\n#積みMac`;
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "積みMacの結果", text: shareText });
        setFeedback("結果を共有しました。");
      } else {
        await navigator.clipboard.writeText(shareText);
        setFeedback("結果をコピーしました。");
      }
    } catch (error) {
      setFeedback(
        error instanceof DOMException && error.name === "AbortError"
          ? "共有をキャンセルしました。"
          : "共有できませんでした。下の結果テキストを選択してコピーできます。",
      );
    }
  };
  const buttons: [Command, string, string][] = [
    ["left", "←", "左移動"],
    ["counterRotate", "↶", "左回転"],
    ["rotate", "↷", "右回転"],
    ["right", "→", "右移動"],
    ["soft", "↓", "高速落下"],
    ["drop", "⇓", "ハードドロップ"],
  ];
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="./" aria-label="積みMac トップ">
          <span className="brand-mark">
            ▰<br />▰
          </span>{" "}
          TSUMI MAC<span className="edition">DESK CHAOS / VOL. 01</span>
        </a>
        <div className="header-actions">
          <button className="quiet" onClick={showHelp}>
            遊び方 <span>↗</span>
          </button>
          <span className="offline">
            <i />
            LOCAL PLAY
          </span>
        </div>
      </header>
      <section className="intro">
        <div>
          <p className="eyebrow">A PHYSICS PUZZLE FOR YOUR INNER COLLECTOR</p>
          <h1>
            積みMac<span> — STACK YOUR MAC</span>
          </h1>
          <p className="tagline">
            買って満足。<em>積んで絶望。</em>
          </p>
        </div>
        <div className="best-label">
          <span>BEST 資産整理</span>
          <strong data-testid="best">{yen(best)}</strong>
          <small>買いすぎた日々の、最高記録。</small>
        </div>
      </section>
      <main className="game-layout">
        <aside className="ledger-panel">
          <div className="panel-heading">
            <span>YOUR ASSETS</span>
            <span>01 / 会計</span>
          </div>
          <div className="expense">
            <span>散財総額</span>
            <strong data-testid="spent">{yen(state.spent)}</strong>
            <small>あのときは、必要だった。</small>
          </div>
          <div className="current-assets">
            <span>
              <i /> 積みMac指数
            </span>
            <strong data-testid="remaining">{yen(state.remaining)}</strong>
            <p>机の上に残された、可能性。</p>
          </div>
          <div className="organized">
            <span>資産整理額</span>
            <strong data-testid="organized">{yen(state.organized)}</strong>
          </div>
          <div className="stats-grid">
            <div>
              <span>整理行数</span>
              <b data-testid="rows">
                {String(state.rows).padStart(2, "0")}
                <small> ROWS</small>
              </b>
            </div>
            <div>
              <span>レベル</span>
              <b>{String(state.level).padStart(2, "0")}</b>
            </div>
            <div>
              <span>最大コンボ</span>
              <b>
                {state.maxCombo}
                <small> COMBO</small>
              </b>
            </div>
            <div>
              <span>プレイ時間</span>
              <b>{time(state.seconds)}</b>
            </div>
          </div>
          <div className="mobile-stats">
            <span>LV. {state.level}</span>
            <span>{state.rows} 行整理</span>
            <span>{time(state.seconds)}</span>
            <span>
              NEXT <b>{state.next.name}</b>
            </span>
          </div>
          <div className="receipt-note">
            <span>— DESK OWNER'S NOTE —</span>
            <p>
              使う予定は、ある。
              <br />
              置く場所は、ない。
            </p>
            <div className="receipt-line" />
          </div>
        </aside>
        <section className="play-column" aria-label="ゲーム">
          <div className="board-toolbar">
            <span>
              <i className={state.status === "playing" ? "live-dot" : ""} />
              {
                {
                  title: "READY TO STACK",
                  playing: "STACKING NOW",
                  paused: "TAKE A BREATH",
                  over: "DESK CAPACITY EXCEEDED",
                }[state.status]
              }
            </span>
            <button
              onClick={togglePause}
              disabled={state.status === "title" || state.status === "over"}
              aria-label={state.status === "paused" ? "再開" : "一時停止"}
            >
              {state.status === "paused" ? "▶" : "Ⅱ"}
            </button>
          </div>
          <div className="board-frame" ref={board} tabIndex={-1}>
            <canvas
              ref={canvas}
              width={360}
              height={648}
              aria-label="10列18行の積みMacフィールド。下のボタンまたはキーボードで操作。"
            />
            {state.message && state.status === "playing" && (
              <div className="event-message" role="status">
                {state.message}
              </div>
            )}
            {state.danger > 0 && state.status === "playing" && (
              <div className="danger-warning">
                容量限界まで {Math.max(0, 2 - state.danger / 1000).toFixed(1)}{" "}
                秒
              </div>
            )}
            {(state.status !== "playing" || help) && (
              <div className="board-overlay">
                <div
                  className={`overlay-content ${help ? "help-content" : ""}`}
                  role="dialog"
                  aria-modal="true"
                  aria-label={
                    help
                      ? "遊び方"
                      : state.status === "title"
                        ? "積みMacを始める"
                        : state.status === "paused"
                          ? "一時停止中"
                          : "ゲーム結果"
                  }
                >
                  {help ? (
                    <>
                      <p className="eyebrow">HOW TO STACK</p>
                      <h2>
                        積む。揃える。
                        <br />
                        資産整理。
                      </h2>
                      <p>
                        1台ずつ落ちてくる架空の機器を、机に積み上げよう。隙間なく横一行を埋めると「資産整理」！
                      </p>
                      <ul className="help-list">
                        <li>各セルの90%以上を埋め、横10セルを揃える。</li>
                        <li>
                          <strong>
                            MVP方式：揃った行に交差する機器は丸ごと整理されます。
                          </strong>
                        </li>
                        <li>
                          接地して0.8秒安定すると配置確定。その後も衝撃で動きます。
                        </li>
                        <li>
                          確定済み機器が危険ラインを2秒超えるか、次の機器を出せなくなると終了。
                        </li>
                        <li>
                          6台目で新型3台、12台目で次の1台が20%引き。以後12台ごとに繰り返します。
                        </li>
                      </ul>
                      <p className="keyboard-help">
                        ← → 移動 / ↑ X・Z 回転 / ↓ 高速落下
                        <br />
                        Space ハードドロップ / P・Esc 一時停止
                      </p>
                      <button
                        className="primary"
                        onClick={() => setHelp(false)}
                      >
                        わかった
                      </button>
                    </>
                  ) : state.status === "title" ? (
                    <>
                      <div className="stack-illustration" aria-hidden="true">
                        <div />
                        <div />
                        <div />
                      </div>
                      <p className="eyebrow">ONE MORE MAC. ONE LESS SPACE.</p>
                      <h2>
                        その1台、
                        <br />
                        どこに置く？
                      </h2>
                      <p>
                        物欲と重力には、逆らえない。
                        <br />
                        積んで、揃えて、机を取り戻そう。
                      </p>
                      <button className="primary" onClick={start}>
                        積みはじめる <span>→</span>
                      </button>
                      <button className="text-button" onClick={showHelp}>
                        はじめての方へ / 遊び方
                      </button>
                      <small className="overlay-caption">
                        PC & TOUCH READY · NO DOWNLOAD
                      </small>
                    </>
                  ) : state.status === "paused" ? (
                    <>
                      <p className="eyebrow">COFFEE BREAK</p>
                      <h2>物欲も、ひと休み。</h2>
                      <p>机はそのまま。ひと息ついてから。</p>
                      <button className="primary" onClick={togglePause}>
                        積むのを再開する →
                      </button>
                      <button className="text-button" onClick={showHelp}>
                        遊び方を確認
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="eyebrow">YOUR DESK HAS LEFT THE CHAT</p>
                      <h2>積みMac崩壊</h2>
                      <p className="result-zero">
                        起動したMac：<strong>0</strong> 台
                      </p>
                      <dl className="result-list">
                        <div>
                          <dt>資産整理</dt>
                          <dd>{yen(state.organized)}</dd>
                        </div>
                        <div>
                          <dt>積みMac指数</dt>
                          <dd>{yen(state.remaining)}</dd>
                        </div>
                        <div>
                          <dt>整理行 / 最大コンボ</dt>
                          <dd>
                            {state.rows} / {state.maxCombo}
                          </dd>
                        </div>
                        <div>
                          <dt>プレイ時間</dt>
                          <dd>{time(state.seconds)}</dd>
                        </div>
                      </dl>
                      <p className="result-joke">
                        これだけMacを買って、
                        <br />
                        結局N100で開発しました。
                      </p>
                      <button className="primary" onClick={start}>
                        もう一度積む →
                      </button>
                      <button className="text-button" onClick={share}>
                        結果をテキストで共有 ↗
                      </button>
                      <textarea
                        className="share-text"
                        readOnly
                        aria-label="共有用の結果テキスト"
                        value={shareText}
                      />
                      {feedback && (
                        <p className="feedback" role="status">
                          {feedback}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="touch-controls" aria-label="ゲーム操作">
            {buttons.map(([command, symbol, label]) => (
              <button
                key={command}
                aria-label={label}
                title={label}
                disabled={state.status !== "playing" || help}
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  e.preventDefault();
                  stopRepeat();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  game.command(command);
                  if (["left", "right", "soft"].includes(command))
                    repeating.current = setInterval(
                      () => game.command(command),
                      100,
                    );
                }}
                onPointerUp={stopRepeat}
                onPointerCancel={stopRepeat}
                onLostPointerCapture={stopRepeat}
                onClick={(e) => {
                  if (e.detail === 0) game.command(command);
                }}
              >
                <span>{symbol}</span>
                <small>
                  {label === "ハードドロップ"
                    ? "DROP"
                    : label === "高速落下"
                      ? "DOWN"
                      : label.includes("回転")
                        ? "ROTATE"
                        : "MOVE"}
                </small>
              </button>
            ))}
          </div>
          <p className="board-footnote">
            10 × 18 GRID <span>机の容量には、限りがあります。</span>
          </p>
        </section>
        <aside className="guide-panel">
          <section className="next-panel">
            <div className="panel-heading">
              <span>NEXT DEVICE</span>
              <span>02 / 次の散財</span>
            </div>
            <div className="next-illustration">
              <DeviceIcon device={state.next} />
            </div>
            <div className="next-details">
              <h2>{state.next.name}</h2>
              <span>
                {state.next.cols} × {state.next.rows} CELLS ·{" "}
                {state.next.mass.toFixed(1)} kg
              </span>
              <strong>
                {yen(state.next.price * (state.discount ? 0.8 : 1))}
              </strong>
              {state.discount && (
                <small className="discount-label">整備済製品 · 20% OFF</small>
              )}
            </div>
          </section>
          <section className="how-card">
            <span className="eyebrow">LESS IS MORE. MAYBE.</span>
            <h3>
              横一列で、
              <br />
              資産整理。
            </h3>
            <div className="mini-grid" aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <p>
              隙間なく並べて、机をすっきり。
              <br />
              重い機器ほど、山が揺れる。
            </p>
            <small>
              ※ MVPでは対象行に交差する
              <br />
              デバイス全体を整理します。
            </small>
          </section>
          <div className="sound-controls">
            <button
              aria-pressed={audio.effects}
              onClick={() => {
                sound.unlock();
                setAudio({ ...audio, effects: !audio.effects });
              }}
            >
              効果音 <b>{audio.effects ? "ON" : "OFF"}</b>
            </button>
            <button
              aria-pressed={audio.music}
              onClick={() => {
                sound.unlock();
                setAudio({ ...audio, music: !audio.music });
              }}
            >
              BGM <b>{audio.music ? "ON" : "OFF"}</b>
            </button>
          </div>
          <div className="device-catalog">
            <span className="eyebrow">THE COLLECTION</span>
            {DEVICES.map((d) => (
              <div key={d.id}>
                <i style={{ background: d.color }} />
                <span>{d.name}</span>
                <small>
                  {d.cols} × {d.rows}
                </small>
              </div>
            ))}
          </div>
        </aside>
      </main>
      <footer>
        <p>
          架空の機器を使った非公式ゲームです。寸法・質量・価格はゲーム用の架空値で、実製品とは異なります。Apple公式の画像・ロゴは使用していません。
        </p>
        <span>BUILT FOR SMALL DESKS & BIG DREAMS.</span>
      </footer>
    </div>
  );
}
