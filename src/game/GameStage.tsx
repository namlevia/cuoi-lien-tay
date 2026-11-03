import { useEffect, useRef, useState } from 'react';
import type { GameState } from './useGame';
import { GAME } from './config';
import { H, W, world } from './world/world';
import './stage.css';

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Màn hình live 1080x1920: sảnh cưới 3D + lớp bảng tên + bảng chữ phía trên */
export function GameStage({ game }: { game: GameState }) {
  const gl = useRef<HTMLCanvasElement>(null);
  const ov = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    world.attach(gl.current!, ov.current!);
    return () => world.detach();
  }, []);

  // đếm ngược trả lời
  const [, tick] = useState(0);
  const v = game.view;
  useEffect(() => {
    if (v?.phase !== 'proposal' && !game.duyen) return;
    const t = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [v?.phase, !!game.duyen]);
  const left = v ? Math.max(0, Math.ceil((v.until - Date.now()) / 1000)) : 0;
  const likePct = Math.min(100, (game.likeProgress / GAME.likesPerBoost) * 100);
  const canSteal = v && (v.phase === 'proposal' || v.phase === 'walk');

  return (
    <div className="dc-stage">
      <canvas ref={gl} width={W} height={H} className="dc-canvas" />
      <canvas ref={ov} width={W} height={H} className="dc-canvas-2d" />

      <header className="dc-title">{GAME.title}</header>

      <div className="dc-bar">
        {v ? (
          <>
            <div className="dc-pair">
              <Ava src={v.groomAva} />
              <span className="dc-heart">♥</span>
              <Ava src={v.brideAva} />
            </div>
            <div className="dc-who">
              <b>
                {cut(v.groom || '?', 11)} ♥ {cut(v.bride || '?', 11)}
              </b>
              <span>
                {v.phase === 'proposal'
                  ? `${cut(v.waiting, 12)} gõ ĐỒNG Ý · ${left}s`
                  : v.phase === 'walk'
                    ? 'Đang lên lễ đường'
                    : v.phase === 'vows'
                      ? 'Đang làm lễ cưới'
                      : 'Vừa cưới xong!'}
              </span>
            </div>
          </>
        ) : (
          <>
            <span className="dc-pill">Cưới</span>
            <div className="dc-who">
              <b>Gõ CƯỚI VỢ @tên</b>
              <span>hoặc CƯỚI CHỒNG @tên người ấy</span>
            </div>
          </>
        )}
        <div className="dc-side">
          <div className="dc-queue">
            💍 <b>{game.married}</b> cặp
          </div>
          <div className="dc-like">
            <span>🥂</span>
            <div className="dc-like-bar">
              <div style={{ width: `${likePct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Hướng dẫn: 1 hàng ngang (bản mobile cắt 2 bên nên không để ở góc) */}
      <div className="dc-guide">
        <span className="dc-guide-h">Gõ:</span>
        <span className="dc-chip">🤵 CƯỚI VỢ @tên</span>
        <span className="dc-chip">👰 CƯỚI CHỒNG @tên</span>
        <span className="dc-chip">💖 ĐỒNG Ý</span>
        <span className="dc-chip">🥂 ZÔ</span>
      </div>
      <div className="dc-guide dc-guide2">
        <span className="dc-chip">👊 ĐẤM @tên</span>
        <span className="dc-chip">😜 TRÊU @tên</span>
        <span className="dc-chip">💃 QUẨY</span>
        <span className="dc-chip">🙏 SE DUYÊN</span>
      </div>

      {canSteal && (
        <div className="dc-steal">
          🦹 Tặng <b>≥{v.price} xu</b> để {v.stealRole === 'groom' ? 'CƯỚP DÂU' : 'CƯỚP RỂ'}!
        </div>
      )}

      {game.duyen && (
        <div className="dc-steal dc-duyen">
          🧧 Gõ <b>SE DUYÊN</b> · {Math.max(0, Math.ceil((game.duyen.until - Date.now()) / 1000))}s · {game.duyen.count} người
        </div>
      )}

      {game.nguyen && (
        <div key={game.nguyen.ten} className="dc-nguyen">
          <div className="dc-nguyen-h">🧵 Nguyệt Lão se duyên</div>
          <div className="dc-nguyen-ten">{game.nguyen.ten}</div>
          <p>{game.nguyen.loi}</p>
        </div>
      )}

      {game.queueLen > 0 && (
        <div className="dc-queue-pill">
          Chờ cưới: <b>{game.queueLen}</b> đám
        </div>
      )}

      {game.lastGift && (
        <div key={game.lastGift.timestamp} className={`dc-gift ${game.lastGift.coins >= GAME.giftBig ? 'dc-gift-big' : ''}`}>
          <b>{cut(game.lastGift.nickname, 18)}</b> gửi quà mừng cưới 🎁
        </div>
      )}
    </div>
  );
}

function Ava({ src }: { src: string }) {
  return src ? <img className="dc-ava" src={src} referrerPolicy="no-referrer" /> : <span className="dc-ava dc-ava-empty">♥</span>;
}
