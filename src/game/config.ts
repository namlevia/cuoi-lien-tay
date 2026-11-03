// =====================================================
//  CẤU HÌNH "CƯỚI LIỀN TAY": số liệu + mọi câu của 2 MC
//  Câu đọc: "M:" anh MC (giọng nam), "F:" chị MC (giọng nữ), giữ giọng tới khi đổi.
//  "|" tách đoạn, "^" hô to hơn. Tên đưa vào đã làm sạch. Không bao giờ đọc nguyên văn comment.
//  Giọng: câu ngắn, dồn dập, 2 MC chọc nhau, cảm thán nhiều (chủ kênh muốn hài + cảm xúc).
// =====================================================

const CHANT = 'Một, hai, ba, dô! Hai, ba, dô! Hai, ba, dô! Hai, ba, uống! Uống cạn ly!';

type N = string;
const roleWord = (r: 'groom' | 'bride') => (r === 'groom' ? 'chú rể' : 'cô dâu');
const stealWord = (r: 'groom' | 'bride') => (r === 'groom' ? 'cướp rể' : 'cướp dâu');

export const GAME = {
  title: 'Cưới Liền Tay',
  defaultChannelName: 'nhà mình',

  // ---------- Luật ----------
  stealMin: 30, // tặng từ 30 xu là cướp được (lần nào cũng 30, không đấu giá)
  answerMs: 60_000, // người được hỏi có 60 giây gõ ĐỒNG Ý
  maxQueue: 5, // đám chờ cưới tối đa
  likesPerBoost: 300,
  giftBig: 99,
  giftThanksCooldownMs: 30_000,
  greetEveryMs: 6000,
  namesPerGreeting: 3,
  chatterQuietMs: 3000,
  shareReminderEveryMs: 4 * 60_000,

  // ---------- Người lướt vào live ----------
  greetings: [
    (n: N) => `M: Ơ ơ ơ! ${n} vừa ghé kìa! | F: ^Vào đây! | F: Cỗ còn nóng, cô dâu chú rể thì chưa có. Biết đâu là bạn đó!`,
    (n: N) => `F: Chào ${n}! | M: Ở đây ai cũng làm cô dâu chú rể được hết! | F: Gõ cưới, a còng, tên người ta. ^Xong!`,
    (n: N) => `M: ${n} ơi! Đi ngang đám cưới mà không vô là mất phần cỗ đó nha! | F: ^Mất luôn con gà!`,
    (n: N) => `F: A! ${n} tới rồi! | M: Ngồi đâu cũng được. | F: Bàn nào cũng có người độc thân! | M: ^Bàn nào cũng có!`,
    (n: N) => `M: Kính thưa quý vị, ${n} vừa tới! | F: ^Pháo tay! | M: Pháo tay thôi nha. Pháo thật để dành lúc cưới!`,
    (n: N) => `F: ${n} ơi! Độc thân thì ở lại. | M: Có người yêu thì dắt vô. | F: ^Hôm nay cưới tại chỗ!`,
  ],

  // ---------- Cầu hôn ----------
  // a = người gõ, b = người được hỏi, role = vai của người gõ
  proposal: {
    groom: [
      (a: N, b: N) => `M: ^Có biến! Có biến rồi bà con ơi! | M: ${a} vừa quỳ xuống cầu hôn ${b}! | F: ^Trời ơi tim tôi! | F: ${b} ơi! Gõ đồng ý là lên xe hoa, gõ không là anh ấy về khóc một mình đó!`,
      (a: N, b: N) => `F: ^Ối giời ơi! | F: ${a} quỳ ngay giữa cổng hoa luôn rồi! | M: Nhẫn có! Hoa có! Can đảm có! | M: Chỉ thiếu mỗi ${b} gật đầu thôi!`,
      (a: N, b: N) => `M: Dừng! Dừng hết lại! | M: ${a} đang xin cưới ${b}! | F: Cái nhẫn kìa, chắc nhịn ăn sáng ba tháng đó! | F: ^${b} ơi gõ đồng ý đi!`,
    ],
    bride: [
      (a: N, b: N) => `F: ^Chị em ơi nhìn kìa! | F: ${a} chủ động hỏi cưới ${b} luôn! | M: ^Thời đại mới rồi bà con! | M: ${b} ơi, người ta quỳ rồi đó, gõ đồng ý lẹ lên!`,
      (a: N, b: N) => `M: ^Ơ kìa! | M: ${a} cầm nhẫn đi hỏi cưới ${b}! | F: Con gái mà dám hỏi cưới là bản lĩnh lắm nha! | F: ${b} mà từ chối là cả hội trường giận đó!`,
      (a: N, b: N) => `F: Hôm nay ${a} hết chịu nổi rồi! | F: ^Tự đi hỏi cưới ${b} luôn! | M: ${b} ơi, cơ hội ngàn năm có một, gõ đồng ý đi em!`,
    ],
    picked: (a: N, role: 'groom' | 'bride') => `M: Ơ, ${a} gõ cưới mà không nói làm cô dâu hay chú rể! | F: Vậy MC bốc giùm luôn! | F: ^${a} làm ${roleWord(role)}! | M: Khỏi cãi!`,
    stealHint: (price: number, role: 'groom' | 'bride') => `F: Ai không chịu? | M: ^${cap(stealWord(role))} đi! | F: Tặng ${price} xu là cướp liền tay!`,
  },
  self: (a: N) => `F: ${a} ơi! Tự cưới chính mình là không được nha! | M: Yêu bản thân thì tốt. Nhưng chọn thêm một người nữa đi em!`,
  queued: (a: N, n: number) => `M: Từ từ ${a} ơi! Đang có đám khác trên lễ đường! | F: Bạn xếp thứ ${n}. Ăn cỗ trước đi, cưới sau!`,
  queueFull: `F: ^Trời đất ơi, hàng chờ cưới dài quá rồi! | M: Từ từ thôi bà con, MC dẫn không kịp!`,
  targetMissing: (b: N) => `F: Mà khoan... ${b} có ở đây không ta? | M: ${b} ơi! Comment một câu vào tiệc rồi gõ đồng ý nha! | F: Người ta quỳ mỏi gối rồi kìa!`,
  targetArrived: (b: N) => `M: ^${b} xuất hiện rồi! | F: Cả hội trường nín thở! | M: Suỵt... nghe được cả tiếng tim đập luôn!`,
  nudge: [
    (b: N, s: number) => `F: ^Còn ${s} giây! | F: ${b} ơi gõ đồng ý đi! | M: Im lặng là đồng ý... à không, ở đây phải gõ mới tính!`,
    (b: N, s: number) => `M: ${b} còn suy nghĩ hả? Còn ${s} giây thôi! | F: ^Nghĩ lẹ lên! Cỗ nguội hết rồi!`,
    (b: N, s: number) => `F: ${s} giây nữa thôi ${b} ơi! | M: Người ta quỳ tê chân rồi kìa! | F: ^Thương người ta đi mà!`,
  ],
  accepted: [
    (a: N, b: N) => `F: ^Đồng ý rồi! Đồng ý rồi! | M: ^Ôi trời ơi! | F: ${b} đã gật đầu với ${a}! | M: Thay đồ! Lên lễ đường! ^Đi!`,
    (a: N, b: N) => `M: ^Thành công rồi bà con ơi! | F: Pháo tay cho ${a} và ${b}! | M: Ban nhạc chuẩn bị! Xe hoa chuẩn bị! | F: Mẹ vợ chuẩn bị tinh thần!`,
    (a: N, b: N) => `F: ^Có! ${b} nói có! | M: ^Hoan hô! | F: ${a} ơi đứng dậy đi, quỳ nãy giờ đủ rồi! | M: Lên lễ đường thôi!`,
  ],
  outfit: (setName: string) => `F: Hôm nay cô dâu chú rể diện bộ ${setName}! | M: ^Đẹp đôi quá trời quá đất!`,
  outfitFunny: `M: Khoan... khoan đã! | M: Chú rể mặc quần đùi, đi dép tổ ong?! | F: Cô dâu thì váy cưới với giày bata! | M: ^Đi cưới hay đi tập thể dục vậy trời!`,
  rejected: [
    (a: N, b: N) => `M: ^Ối dồi ôi! | F: ${b} đã từ chối! | M: ${a} ơi đứng dậy đi em. Ngoài kia còn nhiều người lắm. | F: Ví dụ như MC nè!`,
    (a: N, b: N) => `F: ^Trời ơi! Bị từ chối giữa thanh thiên bạch nhật! | M: ${a} về bàn ăn thêm miếng gà cho đỡ buồn nha. | F: ${b} lạnh lùng ghê!`,
    (a: N, b: N) => `M: ${b} nói không! | F: ^Không! | M: ${a} ơi, cất nhẫn đi em. Để dành cưới người khác!`,
  ],
  timeout: [
    (a: N, b: N) => `M: ^Hết giờ! | F: ${b} không trả lời. | M: ${a} ơi, im lặng không phải lúc nào cũng là vàng. | F: Lần này là cỗ nguội!`,
    (a: N, b: N) => `F: Sáu mươi giây trôi qua mà ${b} vẫn im re! | M: ${a} quỳ không công rồi! | F: Về bàn uống ly nước cam cho bình tĩnh nha!`,
  ],

  // ---------- Lên lễ đường + cướp ----------
  walk: [
    (g: N, b: N) => `F: Và giờ đây! Xin mời cô dâu ${b} và chú rể ${g} tiến vào lễ đường! | M: ^Vỗ tay! Vỗ tay thật to!`,
    (g: N, b: N) => `M: Kính thưa quan viên hai họ! ${g} và ${b} đang bước trên thảm đỏ! | F: Đi chậm thôi! Chưa cưới mà chạy là không được nha!`,
  ],
  walkSteal: (price: number) => `M: Nhưng mà! | F: Đang trên thảm đỏ vẫn cướp được nha! | M: ^Tặng ${price} xu là cướp liền tay!`,
  stolen: [
    (n: N, o: N, role: 'groom' | 'bride') => `M: ^Cướp! Cướp rồi! | F: ^${cap(stealWord(role))}! ${n} ${stealWord(role)} ngay trước mặt ${o}! | M: ${o} ơi, tiền trao cháo múc rồi em ơi!`,
    (n: N, o: N, role: 'groom' | 'bride') => `F: ^Trời đất quỷ thần ơi! | M: ${n} lao vào như cầu thủ ghi bàn! | M: Hất văng ${o} ra ngoài! | F: ${cap(roleWord(role))} giờ đã có người mới!`,
    (n: N, o: N, role: 'groom' | 'bride') => `M: Tường thuật trực tiếp! | M: ${n} vượt qua ${o}... sút! | F: ^Vào! Vào! Vào! | M: ${cap(roleWord(role))} đổi chủ rồi bà con ơi!`,
    (n: N, o: N) => `F: ^Á á á! | F: ${n} vừa cướp người yêu của ${o}! | M: ${o} đứng hình mất năm giây! | F: Phim Hàn cũng không dám viết vậy!`,
  ],
  stealLow: (n: N, need: number) => `F: ${n} ơi! Muốn cướp thì phải ${need} xu nha! | M: Quà này để mừng cưới, cướp chưa đủ đâu!`,
  stealAccept: `M: Tiền trao cháo múc! Khỏi chờ trả lời! | F: ^Lên lễ đường luôn!`,

  // ---------- Làm lễ trên sân khấu (mỗi đám 1 bản, đổi lượt) ----------
  vows: [
    {
      open: (g: N, b: N) => `M: Kính thưa toàn thể quý vị! | F: Ông tơ bà nguyệt se duyên! | M: Hôm nay ${g} và ${b} chính thức về chung một nhà! | F: ^Hoan hô!`,
      promiseG: (g: N) => `M: Chú rể ${g}! Bạn có hứa rửa bát, giặt đồ, và nộp lương đầy đủ không? | F: Im lặng là đồng ý nha! | M: ^Ghi nhận!`,
      promiseB: (b: N) => `F: Cô dâu ${b}! Bạn có hứa không xem điện thoại chồng quá ba lần một ngày không? | M: Ba lần thôi đó! | F: ^Đồng ý luôn!`,
    },
    {
      open: (g: N, b: N) => `F: Kính thưa quan viên hai họ! | M: Hôm nay trời đẹp! Cỗ ngon! | F: Và ${g} với ${b} chính thức thoát kiếp độc thân! | M: ^Chúc mừng!`,
      promiseG: (g: N) => `F: Chú rể ${g}! Sau này cãi nhau, ai xin lỗi trước? | M: Chú rể chỉ vào mình rồi! | F: ^Biết điều quá!`,
      promiseB: (b: N) => `M: Cô dâu ${b}! Có hứa nấu ăn ngon không? | F: Hoặc ít nhất là gọi đồ ăn ngon! | M: ^Cô dâu nói có!`,
    },
  ],
  ring: `M: Xin mời đôi uyên ương trao nhẫn cưới! | F: Nhẫn vàng thật nha bà con! | M: Vàng thật... trong game!`,
  hug: `F: Và bây giờ! Cô dâu chú rể trao nhau một cái ôm thật chặt! | M: Một! Hai! Ba! | F: ^Ôm!`,
  toast: `M: Cả hội trường nâng ly nào! | F: ${CHANT}`,
  closing: [
    (g: N, b: N) => `F: Chúc ${g} và ${b} trăm năm hạnh phúc! Đầu bạc răng long! | M: Con cháu đầy nhà! | F: Ai muốn là cặp tiếp theo thì gõ cưới, a còng, tên người ta nha!`,
    (g: N, b: N) => `M: Chúc ${g} và ${b} sớm có tin vui! | F: ^Sinh đôi luôn! | M: Cặp tiếp theo là ai đây? Gõ cưới, a còng, tên người ấy!`,
  ],

  // ---------- Danh hiệu trên bảng tên ----------
  titles: {
    married: (partner: N) => `💍 Đã cưới ${partner}`,
    stealer: (role: 'groom' | 'bride') => (role === 'groom' ? '🦹 Siêu trộm rể' : '🦹 Siêu trộm dâu'),
    robbed: '💔 Bị cướp người yêu',
    rejected: '💔 Bị từ chối',
  },

  // ---------- Quà theo cấp (xu 1 lần tặng) ----------
  // fx: hearts, confetti, petals, fireworks, gold, party
  giftTiers: [
    {
      min: 999,
      fx: ['fireworks', 'gold', 'hearts', 'party', 'petals'],
      lines: [(n: N) => `M: ^Không thể tin được! | F: ^Trời ơi trời ơi! | M: ${n} là khách VIP của đám cưới hôm nay! | F: Cô dâu chú rể cúi đầu cảm ơn ${n}! | M: ^Hoan hô!`],
    },
    {
      min: 299,
      fx: ['gold', 'party', 'confetti'],
      lines: [
        (n: N) => `F: ^Đại gia! Đại gia xuất hiện! | M: ${n} làm cả hội trường mưa vàng luôn! | F: ^Đứng dậy quẩy!`,
        (n: N) => `M: ^Trời ơi ${n}! | F: Quà này mừng được ba đám cưới luôn đó! | M: Cô dâu xỉu rồi kìa!`,
      ],
    },
    {
      min: 99,
      fx: ['fireworks', 'confetti'],
      lines: [
        (n: N) => `M: ^Pháo hoa! | F: ${n} bắn pháo hoa mừng cưới! | M: Bàn của ${n} được thêm con gà luộc!`,
        (n: N) => `F: ^Ôi đẹp quá! | M: Cảm ơn ${n}! | F: Pháo hoa này cô dâu nhớ cả đời!`,
      ],
    },
    {
      min: 30,
      fx: ['confetti', 'hearts'],
      lines: [
        (n: N) => `F: ^Ôi! ${n} chơi lớn! | M: Pháo giấy đâu? ^Bắn!`,
        (n: N) => `M: ${n} gửi phong bì dày nè bà con! | F: ^Cảm ơn ${n}!`,
      ],
    },
    {
      min: 10,
      fx: ['hearts', 'petals'],
      lines: [
        (n: N) => `M: ${n} gửi quà mừng cưới! | F: Hoa rơi rồi kìa! Lãng mạn ghê!`,
        (n: N) => `F: Cảm ơn ${n}! | M: Quà nhỏ mà tình to!`,
      ],
    },
    {
      min: 1,
      fx: ['hearts'],
      lines: [(n: N) => `F: Cảm ơn ${n}! | M: Cô dâu chú rể nhận hết!`, (n: N) => `M: ${n} gửi quà! | F: Thương ${n} ghê!`],
    },
  ],

  boostLine: `M: ^Ba trăm tim rồi bà con ơi! | F: Cả hội trường đứng dậy! | M: ${CHANT}`,
  zoLine: `F: Bàn nào cũng cụng ly rồi kìa! | M: ${CHANT}`,
  thankFollow: (n: N) => `F: Cảm ơn ${n} đã theo dõi kênh! | M: Theo dõi rồi là người nhà! | F: Cưới ở đây khỏi đóng tiền mừng!`,
  shareLines: [
    `M: Bà con ơi! Chia sẻ live cho bạn bè vào ăn cưới với! | F: Đông vui mới có người để cưới chứ!`,
    `F: Ai có đứa bạn độc thân thì chia sẻ live cho nó! | M: ^Biết đâu hôm nay nó có vợ!`,
  ],
  shareWithNames: (names: string) => `M: ${names} ơi! Chia sẻ live cho bạn bè vào ăn cưới nha! | F: Đông vui mới có người để cưới!`,

  // ---------- Mai mối: camera zoom vào 1 bàn, MC ép 2 bạn lên cưới (cổ vũ thật mạnh) ----------
  pairEveryMs: 50_000,
  pair: [
    (a: N, b: N) => `M: ^Camera! Zoom vào bàn này cho MC! | F: Ối giời ơi, ${a} với ${b} ngồi sát rạt nãy giờ! | M: ^Lên! Lên! Lên! | F: Váy cưới MC ủi sẵn rồi, chỉ thiếu người mặc thôi!`,
    (a: N, b: N) => `F: ^Khoan! Dừng nhạc! | F: Bàn này có biến! | M: ${a} nhìn ${b} bằng ánh mắt tình bể bình luôn! | F: ^Cưới! Cưới! Cưới! | M: Cả hội trường hô theo MC nào!`,
    (a: N, b: N) => `M: ${a} ơi! ${b} ơi! | F: ^Đứng dậy! | M: Một người mặc vest, một người mặc váy cưới. Ai mặc gì tự thỏa thuận! | F: ^Lên lễ đường liền tay!`,
    (a: N, b: N) => `F: Thưa bà con, MC vừa phát hiện một cặp trời sinh! | M: ^${a} và ${b}! | F: Ngồi chung bàn, ăn chung đĩa, tranh nhau cái đùi gà! | M: ^Chưa cưới là phí của trời!`,
    (a: N, b: N) => `M: ^Á à! | M: ${b} vừa gắp miếng gà cho ${a} kìa! | F: Gắp gà là thương rồi đó! | M: ^Cưới! Cưới ngay! | F: Gõ cưới, a còng, tên người ta. Dễ ợt!`,
    (a: N, b: N) => `F: ${a} ơi, mặc váy cưới vào chắc đẹp lắm nha! | M: Còn ${b} mặc vest thì đẹp trai hết phần thiên hạ! | F: ^Còn chờ gì nữa! | M: ^Cưới! Cưới! Cưới!`,
    (a: N, b: N) => `M: Bà con ơi, cho MC xin một tràng cưới đi! | F: ^Cưới đi! Cưới đi! Cưới đi! | M: ${a} với ${b} nghe chưa? Cả làng ủng hộ rồi đó! | F: Không cưới là MC khóc tại chỗ!`,
    (a: N, b: N) => `F: ^Tin nóng! | F: ${a} vừa liếc ${b} ba lần trong một phút! | M: Theo khoa học, liếc ba lần là yêu! Liếc bốn lần là cưới! | F: ^Cưới liền tay!`,
    (a: N, b: N) => `M: ${a} ơi, nhẫn nè, MC cho mượn! | F: ${b} ơi, váy cưới nè, MC cho thuê giá rẻ! | M: ^Lên! Lên! Lên! | F: Gõ cưới, a còng, tên người ta là xong!`,
    (a: N, b: N) => `F: Trời ơi, bàn này ai cũng có đôi mà ${a} với ${b} vẫn lẻ bóng! | M: ^Ghép luôn! | F: Ông tơ bà nguyệt đứng sau lưng hai bạn nãy giờ rồi đó! | M: ^Cưới!`,
    (a: N, b: N) => `M: ^Hội trường ơi! Hô to tên ${a}! | F: ^Và ${b}! | M: Hai bạn lên đây mặc đồ cưới cho MC coi! | F: Ngại thì MC xuống tận bàn đẩy lên!`,
    (a: N, b: N) => `F: MC đọc được suy nghĩ của ${a} nè. | F: Đang nghĩ: ước gì ${b} hỏi cưới mình! | M: ^Trời ơi lộ rồi! | M: ${b} ơi, người ta chờ nãy giờ, gõ cưới đi!`,
  ],
  pairBubble: ['🙈 Ngại quá à', '😏 Cũng được...', '💓 Tim đập nhanh rồi', '🤭 MC ác ghê', '😳 Ai? Tui hả?'],
  pairPush: [
    (a: N, b: N) => `M: ${a} ơi, vẫn chưa gõ hả? | F: ^Gõ đi! Cả hội trường đang chờ! | M: Cưới, a còng, ${b}. Có ba chữ thôi mà!`,
    (a: N, b: N) => `F: ${b} ơi, hay là bạn hỏi cưới trước luôn đi! | M: ^Thời đại mới! Ai hỏi trước cũng được! | F: ${a} đang ngồi chờ kìa!`,
    (a: N, b: N) => `M: Hai bạn ${a} với ${b} còn ngại hả? | F: Ngại thì để MC hỏi giùm! | M: ^Cưới không? Cưới không? | F: Im lặng là đồng ý nha!`,
  ],

  // ---------- Nguyệt Lão se duyên: mời gõ SE DUYÊN, hết giờ bốc 2 người buộc tơ hồng ----------
  duyen: {
    everyMs: 4 * 60_000,
    windowMs: 30_000,
    intro: [
      `M: ^Bà con ơi, tới giờ se duyên rồi! | F: Nguyệt Lão vừa xuống trần, tay cầm cuộn chỉ đỏ dài cả cây số! | M: Ai độc thân thì gõ se duyên! Ba mươi giây thôi nha!`,
      `F: Đèn mờ, khói lên... Nguyệt Lão xuất hiện! | M: ^Ai muốn có người yêu thì gõ se duyên ngay! | F: Gõ càng sớm, tơ hồng càng chắc!`,
      `M: Thông báo khẩn! Nguyệt Lão đang phát tơ hồng miễn phí! | F: Số lượng có hạn! | M: ^Gõ se duyên! Nhanh tay lên bà con!`,
      `F: Nguyệt Lão nói hôm nay ổng còn dư hai cuộn chỉ đỏ. | M: Ai gõ se duyên thì ổng buộc cho một đầu! | F: Đầu kia buộc vào ai thì... hên xui!`,
      `M: ^Ông tơ bà nguyệt có mặt! | F: Ai đang ế, ai mới chia tay, ai thích thầm người ta, gõ se duyên đi! | M: Ế càng lâu càng được ưu tiên!`,
      `F: Nguyệt Lão hỏi phòng này ai còn độc thân? | M: ^Gõ se duyên cho ổng đếm coi! | F: Đếm xong ổng se luôn, khỏi chờ tới tết!`,
    ],
    count: [
      (n: number) => `M: ${n} người xin duyên rồi! | F: ^Thêm nữa! Thêm nữa!`,
      (n: number) => `F: Đã có ${n} người! Nguyệt Lão cười tít mắt luôn! | M: ^Ai chưa gõ thì gõ lẹ!`,
      (n: number) => `M: ${n} người ế đã lộ diện! | F: Phòng này hot quá trời!`,
    ],
    before: [
      `M: Hết giờ! Nguyệt Lão gửi lời nguyện cho bà con.`,
      `F: Mọi người im lặng một chút nha. Nguyệt Lão có đôi lời.`,
      `M: Nhạc nhỏ lại... Nguyệt Lão bắt đầu se duyên.`,
    ],
    pair: [
      (a: N, b: N) => `M: ^Và Nguyệt Lão đã quyết định! | M: Tơ hồng nối ${a} với ${b}! | F: ^Trời ơi duyên trời định! | M: ${a} ơi, gõ cưới, a còng, ${b} liền!`,
      (a: N, b: N) => `F: Cuộn chỉ đỏ bay vèo qua hội trường... | F: ^Và dính vào ${a} với ${b}! | M: Nguyệt Lão buộc rồi là không gỡ được đâu nha! | F: ^Cưới thôi!`,
      (a: N, b: N) => `M: Nguyệt Lão nheo mắt, lựa tới lựa lui... | M: ^Chọn ${a} và ${b}! | F: Ổng nói kiếp trước hai bạn là hàng xóm, kiếp này phải làm vợ chồng! | M: ^Cưới!`,
      (a: N, b: N) => `F: ^Tơ hồng đã se! | F: ${a} và ${b}, nhìn sợi chỉ đỏ trên đầu đi! | M: Ai gõ cưới trước thì người đó chủ động! | F: Nhanh lên kẻo người khác cướp!`,
      (a: N, b: N) => `M: Nguyệt Lão tuyên bố: ${a} với ${b} hợp tuổi, hợp mệnh, hợp cả khẩu vị ăn cỗ! | F: ^Còn chần chừ gì nữa! | M: Gõ cưới, a còng, tên người ta!`,
      (a: N, b: N) => `F: ^Ối giời ơi! | F: ${a} với ${b} bị buộc chung một sợi chỉ mà cười tủm tỉm kìa! | M: Không nhầm đâu, duyên đó! | F: ^Pháo tay chúc mừng!`,
      (a: N, b: N) => `M: Sợi chỉ đỏ này nối ${a} với ${b}! | F: Theo luật Nguyệt Lão, hai bạn có sáu mươi giây để cưới! | M: Không cưới là ^Nguyệt Lão giận!`,
      (a: N, b: N) => `F: Nguyệt Lão thì thầm vào tai MC... | M: Ổng nói ${b} để ý ${a} lâu rồi mà ngại! | F: ^Thôi khỏi ngại! | M: Lên lễ đường luôn!`,
    ],
    single: (a: N) => `F: Mới có ${a} xin duyên thôi! | M: Nguyệt Lão buộc một đầu chỉ cho ${a} rồi, đầu kia còn trống! | F: Ai muốn nắm đầu dây còn lại thì gõ cưới, a còng, ${a}!`,
    none: [
      `M: Nguyệt Lão ngồi chờ mỏi lưng mà không ai xin duyên! | F: Phòng này toàn người có đôi hết rồi hả? | M: ^Không tin! Lát ổng quay lại hỏi tiếp!`,
      `F: Không ai gõ se duyên luôn? | M: Nguyệt Lão cuộn chỉ đỏ lại, đi về buồn hiu! | F: Lát nữa ổng quay lại, nhớ gõ nha bà con!`,
    ],
    bubble: ['🙏 Xin duyên!', '🧧 Se cho con với', '💘 Con ế lâu rồi', '🙏 Nguyệt Lão ơi'],
  },
  titleThread: (partner: N) => `🧵 Tơ hồng với ${partner}`,
  // người tặng quà lúc se duyên: lên sân khấu làm Nguyệt Lão
  matchmaker: [
    (a: N) => `M: ^${a} vừa tặng quà! | F: Vậy hôm nay ${a} lên làm Nguyệt Lão luôn! | M: Râu bạc, áo đỏ, quyền se duyên cả phòng! ^Lên sân khấu!`,
    (a: N) => `F: ^Ối! ${a} chơi lớn! | M: Nguyệt Lão thật xin nghỉ phép, nhường ghế cho ${a}! | F: Ai được ${a} se duyên thì phải cưới nha!`,
    (a: N) => `M: Thông báo! Nguyệt Lão hôm nay là ${a}! | F: Mới mọc râu ba giây mà nhìn uy tín ghê! | M: ^Vỗ tay cho Nguyệt Lão mới!`,
  ],
  pairBy: [
    (m: N, a: N, b: N) => `F: Nguyệt Lão ${m} nhắm mắt... chỉ tay! | M: ^Trúng ${a} và ${b}! | F: Nguyệt Lão ${m} đã phán, cãi là xui ba năm! | M: Gõ cưới, a còng, tên người ta đi!`,
    (m: N, a: N, b: N) => `M: Nguyệt Lão ${m} quăng cuộn chỉ đỏ... | F: ^Dính ${a} với ${b}! | M: Nguyệt Lão nghiệp dư mà ném chuẩn ghê! | F: Hai bạn cưới đi cho Nguyệt Lão ${m} có thành tích!`,
    (m: N, a: N, b: N) => `F: Nguyệt Lão ${m} vuốt râu, suy nghĩ rất lâu... | M: Rồi chọn đại! ^${a} và ${b}! | F: Chọn đại mà trúng duyên thật đó nha!`,
  ],

  // ---------- Đánh nhau, trêu nhau (hài, MC bình luận như xem võ) ----------
  fight: [
    (a: N, b: N) => `M: ^Ê ê ê! | M: ${a} vừa đấm ${b} một phát! | F: Đi ăn cưới chứ không phải lên võ đài nha! | M: ^Trọng tài đâu!`,
    (a: N, b: N) => `F: ^Trời ơi! ${a} với ${b} choảng nhau rồi! | M: Chắc giành cái đùi gà! | F: Bảo vệ ơi, ra can giùm!`,
    (a: N, b: N) => `M: Tường thuật trực tiếp! ${a} tung cú đấm thẳng... | F: ^Trúng ${b}! | M: Một không! Ăn cưới mà như xem đấm bốc!`,
    (a: N, b: N) => `F: ${b} ơi, bị ${a} đấm rồi kìa! | M: Đánh nhau ở đám cưới là điềm báo... ^sắp cưới nhau đó! | F: Ghét của nào trời trao của đó!`,
    (a: N, b: N) => `M: ^Á à! ${a} ra tay rồi! | F: ${b} ôm đầu kêu mẹ! | M: Làm lành đi, gõ cưới, a còng, tên nhau là hết giận!`,
    (a: N, b: N) => `F: MC xem lại pha quay chậm... | M: ${a} lấy đà, xoay người, ^bốp! | F: ${b} bay mất cái kẹp tóc! Đỉnh!`,
  ],
  fightTable: [
    (n: number) => `M: ^Bàn số ${n} đánh nhau kìa! | F: Ăn cỗ mà như đi đánh trận! | M: Bình tĩnh, cỗ còn nhiều mà!`,
    (n: number) => `F: Bàn ${n} có biến! | M: Hai ông khách tranh nhau miếng giò! | F: ^Nhân viên ơi, bưng thêm giò ra bàn ${n}!`,
    (n: number) => `M: Bàn ${n} vừa có một pha võ thuật! | F: Đám cưới hay lò võ vậy trời!`,
    (n: number) => `F: ^Ối giời! Bàn ${n} ai đó vừa ăn một cú cùi chỏ! | M: Chắc tại uống hơi nhiều nước ngọt!`,
  ],
  tease: [
    (a: N, b: N) => `F: ${a} chạy qua chọc ${b} kìa! | M: Trêu nhau là thích nhau đó, MC nói rồi! | F: ^Cưới đi!`,
    (a: N, b: N) => `M: ${a} vừa chọc lét ${b}! | F: ${b} cười không nhặt được mồm! | M: Hai đứa này có mùi tơ hồng!`,
    (a: N, b: N) => `F: Ơ ${a} lại ghẹo ${b} nữa! | M: ^Ghẹo hoài là phải chịu trách nhiệm nha!`,
  ],
  noTarget: (b: N) => `M: ${b} là ai ta? Chưa thấy vào tiệc! | F: ${b} ơi comment một câu vào đây đi, có người tìm kìa!`,
  danceJoin: [
    (a: N) => `F: ${a} ra sàn quẩy rồi kìa! | M: ^Quẩy lên! | F: Nhảy như chưa từng được nhảy!`,
    (a: N) => `M: ${a} vừa nhập hội đội nhảy! | F: Động tác hơi lạ nhưng nhiệt tình là được!`,
    (a: N) => `F: ^Nhìn ${a} kìa! | M: Nhảy kiểu này là hết cứu, nhưng mà vui!`,
  ],
  danceCrew: [
    `M: ^Đội nhảy đâu! Ra sân! | F: Các thanh niên nghiêm túc... ^lộn nhào! | M: Bà cụ cũng xoay vòng kìa trời!`,
    `F: Đội nhảy lên sàn rồi bà con ơi! | M: Có em bé, có bà nội, có cả chú mặc váy cô dâu! | F: ^Đội hình không ai giống ai!`,
    `M: Nhạc lên! | F: ^Đội nhảy quẩy tung nóc! | M: Anh quần đùi dép tổ ong nhảy xung nhất đội!`,
    `F: Ai cũng nhảy đều, có một bạn lộn nhào không ai bảo! | M: ^Biên đạo ơi cứu!`,
  ],


  // ---------- MC rảnh thì nói ----------
  chatter: {
    howTo: [
      `M: Luật nhà mình dễ ợt! | F: Gõ cưới vợ, a còng, tên người ta. | M: Hoặc cưới chồng, a còng, tên người ta. | F: Người kia gõ đồng ý là ^lên lễ đường!`,
      `F: Ai đang thích thầm ai thì nay là cơ hội! | M: Gõ cưới, a còng, tên người đó! | F: Bị từ chối thì MC an ủi bằng một tràng pháo tay!`,
      `M: Thấy người ta sắp cưới mà mình cũng thích? | F: ^Cướp luôn! | M: Tặng ba mươi xu là cướp được dâu, cướp được rể!`,
    ],
    crowd: (n: number) => `M: ${n} khách trong tiệc! | F: ${n} người mà chưa ai dám cưới! | M: ^MC buồn ghê!`,
    married: (k: number) => `M: Hôm nay đã có ${k} cặp về chung một nhà! | F: ^Cặp tiếp theo là ai đây?`,
    onStage: (g: N, b: N) => `F: ${g} với ${b} vẫn đứng vẫy tay trên sân khấu kìa! | M: Ai muốn là đám tiếp theo thì gõ cưới nha!`,
    questions: [
      `F: Ai đang độc thân thì gõ một chữ độc thân cho MC xem nào!`,
      `M: Bà con thích cô dâu mặc váy cưới hay áo dài? | F: Comment cho MC biết với!`,
      `F: Đám cưới mà không ai cướp dâu thì buồn lắm! | M: ^Có ai dám không?`,
      `M: Ai từng bị người yêu cũ đi cưới người khác thì gõ chữ khóc! | F: MC thương!`,
    ],
    zo: [`M: Bàn nào chưa cụng ly thì gõ zô! | F: ^Gõ zô là cả bàn nâng ly liền!`],
  },
};

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export { roleWord };
