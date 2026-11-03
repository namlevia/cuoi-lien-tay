# Đám Cưới Online: ghi chú cho Claude

> File này mô tả RIÊNG game này. Luật chung cho mọi game nằm ở `E:\VibeCode\CLAUDE.md` (Claude tự đọc cả hai).
> Khi chủ kênh chốt một quyết định (câu đọc, màu, font, luật chơi), ghi vào mục "Quyết định của chủ kênh".

## Ý tưởng

Đám cưới quê dựng rạp ngoài sân, kiểu chibi 2.5D. Người xem comment là thành khách mời đi vào qua cổng hoa. Bưng mâm cỗ để được lên sân khấu chụp hình với cô dâu chú rể, cụng ly, quẩy, bắt hoa cưới. MC đọc tên, cảm ơn quà, chúc khách.

## Luật chơi

- Comment lần đầu: khách chibi vào rạp (ngoại hình cố định theo username). Comment thường hiện bong bóng trên đầu (đã che từ bậy).
- BƯNG MÂM: vào bếp lấy mâm mang ra bàn. Lần đầu bưng 2 mâm mới được chụp hình, sau đó 1 mâm, cách 5 phút.
- CHỤP HÌNH: xếp hàng (tối đa 20) bên phải, tới lượt lên sân khấu, đèn flash, thẻ "Ảnh cưới" + MC đọc 1 trong 99 lời chúc (`src/game/loiChuc.ts`). Ảnh hiện ít nhất 9 giây, đợi MC đọc xong mới tới người sau.
- DZÔ: ngồi vào bàn nâng ly (hết ghế thì ra quẩy). QUẨY: ra sàn nhảy, đèn sân khấu quét.
- Tung hoa: 10 phút một lần, gõ BẮT HOA trong 30 giây, cô dâu tung về 1 người ngẫu nhiên. Không cần quà.
- Tim: đủ 300 tim cả rạp nâng ly "một, hai, ba, dzô".
- Quà chỉ là hiệu ứng chung (pháo giấy, bóng bay, pháo hoa, cô dâu chú rể nhảy), không cho chen hàng. MC cảm ơn quà trước mọi câu khác.
- Tiến độ bưng mâm được nhớ qua các buổi live (localStorage `damcuoi-progress` trên trang stage).

## File của game này

- `src/game/config.ts`: số liệu + mọi câu MC.
- `src/game/rules.ts`: đọc lệnh trong comment, tiến độ bưng mâm/chụp hình. Test: `npx tsx src/game/rules.check.ts`.
- `src/game/useGame.ts`: nối sự kiện TikTok vào luật chơi và giọng đọc.
- `src/game/world/`: rạp cưới trên canvas, không React. `layout.ts` toạ độ, `scene.ts` vẽ rạp, `chibi.ts` vẽ nhân vật, `world.ts` khách đi lại, hàng chờ, hiệu ứng.
- `src/game/GameStage.tsx` + `stage.css`: tiêu đề, thanh "Đang chụp hình", bảng hướng dẫn, thẻ ảnh cưới.
- `src/game/GameControls.tsx`: nút giả lập, có "Live giả" 40 khách tự chơi.
- `src/live/voice.ts`: thêm `say(text, priority, done)` để biết lúc MC đọc xong lời chúc.

## Quyết định của chủ kênh

- Bỏ chủ đề chùa / xin quẻ (né tôn giáo), làm đám cưới. Claude tự chọn: đám cưới quê, cô dâu chú rể cố định, bưng 2 mâm mới chụp.
- Người tặng quà được MC đọc trước.
- Giọng MC có cảm xúc: Edge NamMinh, pitch +6%, tốc độ 1.1. Câu hô viết dạng "Trời ơi! | ^Hoan hô!": "|" tách đoạn, "^" hô to hơn (server `hype=1`: chỉ volume +40%, KHÔNG đổi pitch). Đã thử đổi pitch (+35%) và kéo dài chữ "Dô": nghe như 2 người nói, chủ kênh chê, bỏ.
- "Dô" đọc giọng thường như các câu khác. Quà hô theo 7 cấp (1/10/30/99/299/999/4999 xu), giọng hơi bựa, mỗi cấp có hiệu ứng riêng (`GAME.giftTiers`).
- 300 tim: cả rạp lên đèn, ai cũng nhảy tại chỗ (không phải ra sàn).
- Cô dâu chú rể đi chào bàn, có người chờ chụp hình thì về sân khấu. Tên cô dâu chú rể do khán giả bầu bằng comment (tự bầu khi đủ 5 khách, hoặc nút ở trang điều khiển), MC dùng tên đó khi nói.
- MC nói liên tục: giọng im 4 giây là nói câu mới (gọi tên khách, hỏi khán giả, kể rạp đang vui).
- Rạp phải thật đông: 23 bàn x 8 ghế, 110 khách đệm (không tên) + 30 người đứng xem; người thật vào thì khách đệm về bớt.
- Khách: 4/10 người tóc nhuộm (đỏ, cam, vàng, trắng, hồng), đồ có vest, chấm bi, kẻ sọc, kính, nơ.
- Long phượng sum vầy: trên phông cưới và biển Vu Quy; quà từ 999 xu thì rồng phượng bay ngang trời.
- Nhạc nền: `public/assets/audio/nhac-nen-dam-cuoi.m4a` (chủ kênh đưa, không đưa lên git), chỉ trang stage phát, MC nói thì nhạc tự nhỏ xuống (`src/game/music.ts`).
- Người lướt vào live: MC đọc tên + mời vào ăn cưới (`GAME.greetings`). Có thêm bộ câu kéo comment `GAME.chatter.hype`.
- Khai mạc lễ cưới (`GAME.ceremony`, lời dẫn của chủ kênh, 2 bản đổi lượt): chạy sau khi bầu xong cô dâu, hoặc nút "Khai mạc". Đọc xong lời mở đầu thì cô dâu chú rể đi thảm đỏ từ cổng lên sân khấu, rồi trao nhẫn (nhẫn vàng bay lên), cảm ơn, mời tiệc. Câu khai mạc dùng `keep` nên không bị bỏ dù chờ lâu.
- Câu hô cụng ly chung (`CHANT` trong config): "Một, hai, ba, dô! Hai, ba, dô! Hai, ba, dô! Hai, ba, uống! Uống cạn ly!"
- Có 4 chó 4 mèo chạy quanh tiệc (`src/game/world/pets.ts`), chó thỉnh thoảng đuổi mèo. Hoa hồng trang trí dọc thảm đỏ, mép sân khấu, vải rạp, cột, bình hồng giữa bàn.
- Bản mobile TikTok cắt ~100px mỗi bên và đè huy hiệu kênh + xếp hạng ở góc trên trái (tới ~y 255). Mọi chữ/bảng phải nằm trong x 105–975: thanh chụp hình y 262, hàng hướng dẫn "Gõ: BƯNG MÂM · CHỤP HÌNH · DZÔ · QUẨY" một hàng ngang y 380, thẻ ảnh cưới y 470. Bếp, hàng chờ chụp hình cũng đã dời vào trong.
- Lúc bầu tên, comment khen ("đẹp quá", "xinh ghê", "chúc mừng"...) không tính là phiếu (`NOT_NAME` trong rules.ts).
- Gõ bưng mâm lúc đang bưng: nhớ lại, bưng tiếp khi xong.
- TikTok cấm chữ "dzô" trong comment: mọi chữ hiện trên màn hình là "ZÔ" (lệnh nhận cả zô/dzô). Giọng MC vẫn đọc "dô" (giọng Bắc ra âm zô).
- Danh hiệu trên tên (`GAME.titles`, logic `Titles` trong rules.ts): dẫn đầu thì lên chức bảng vàng + MC đọc (Khách VIP, Trưởng ban tiếp rượu, Trưởng ban hậu cần, Vua sàn nhảy, Trưởng ban tám chuyện; phải ≥2 lần), không thì danh hiệu mốc bảng hồng.
- Âm lượng nhạc nền chỉnh ở trang điều khiển (0–200%, gửi `musicVol:NN`), trang stage nhớ mức đã chỉnh.
- Giọng đọc có tự gỡ kẹt (voice.ts): live thật từng bị MC im cả buổi vì câu đầu bị chặn tự phát tiếng và treo.
- Nền đang vẽ bằng code. Chủ kênh có thể làm ảnh rạp cưới trống (không người) 1080x1920 để thay.
