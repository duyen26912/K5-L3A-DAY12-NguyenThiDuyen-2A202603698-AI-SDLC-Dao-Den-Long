# Đảo Đèn Lồng

> **Video demo:** sẽ bổ sung ở Phase 4 (Release `v1.0.0`).
> Day 12 AI SDLC · Nguyễn Thị Duyên · 2A202603698 · Tài liệu lab: [docs/lab/](docs/lab/README.md)

Game 3D góc nhìn thứ ba qua **3 Đêm**: Đảo Bến, Đảo Cau, Đảo Chuông. Bạn là **Mây**, người giữ đèn nhỏ tuổi, nhặt đom đóm, mang về thắp lại các **Đèn Lồng Lớn**, né **Bóng Mực** và **Gió Lạc** trong sương đen. Đèn hết dầu sẽ tắt — phải châm dầu và **giữ đủ đèn sáng tới bình minh** (≥ 60% số đèn) mới thắng Đêm; hết Ngọn Lửa là thua. Thắng cả 3 Đêm để thấy Bình Minh.

**Stack:** TypeScript · [Three.js](https://threejs.org) (chạy trên trình duyệt) · Node.js ≥ 20.19 cho build và headless. Chạy được trên **macOS, Linux và Windows**, không cần GPU cho chế độ headless.

## Cài đặt và chạy (3 lệnh)

```bash
git clone https://github.com/duyen26912/K5-L3A-DAY12-NguyenThiDuyen-2A202603698-AI-SDLC-Dao-Den-Long.git && cd K5-L3A-DAY12-NguyenThiDuyen-2A202603698-AI-SDLC-Dao-Den-Long
```

```bash
npm ci && npm run build
```

```bash
npm run preview -- --open
```

Trình duyệt mở `http://localhost:4173`. Có thể chọn seed cố định: `http://localhost:4173/?seed=2026`. Thư mục `dist/` sau khi build là bản web tĩnh, đặt lên bất kỳ web server nào cũng chạy.

## Điều khiển

| Phím | Hành động |
|---|---|
| ↑ ↓ ← → (hoặc W A S D) | Đi tới / lùi / sang trái / sang phải (theo hướng camera) |
| Giữ chuột trái và kéo | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| Space | Nhảy |
| Shift | Lướt |
| E | Nạp ánh sáng vào đèn tắt / châm dầu đèn đang sáng (trong 2 m) |
| Q | Tỏa Sáng: tốn 3 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 5 m |
| Esc / P | Tạm dừng (Tiếp tục · Chơi lại Đêm · Cài đặt · Về menu) |
| H | Ẩn / hiện bảng điều khiển trên màn hình |
| F3 | Bật/tắt bộ đếm FPS (hoặc mở với `?fps=1`) |

Luồng chơi: Menu chính → giới thiệu Đêm (lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. Thua thì chơi lại Đêm đó. Cài đặt (âm lượng, độ nhạy chuột, **bảng màu dễ phân biệt** cho người mù màu) được lưu giữa các lần mở game.

## Luật chơi và cách tính điểm (Ticket-02 + Ticket-03)

- Chạy 6 m/s, nhảy 7 m/s, Lướt 14 m/s trong 0.2 s (hồi chiêu 1.5 s). Rơi khỏi đảo: −1 Ngọn Lửa, mất hết đom đóm, hồi sinh ở điểm xuất phát.
- Đom đóm tự nhặt trong 1 m. **Sức chứa = 10 + 2 × số lần thắp thành công**, tối đa 20.
- Đèn cần 10 đom đóm để thắp lần đầu (5 nếu thắp lại). Đèn sáng có **dầu 100, hao 1/giây**; bấm E ở đèn đang sáng để châm dầu (mỗi đom đóm +10). Hết dầu thì đèn **tắt**.
- Đèn có dầu ≥ 30 tạo vùng an toàn 6 m. Dầu < 30: mất vùng an toàn, đèn nhấp nháy, Bóng Mực kéo tới **hút dầu** (5/giây).
- Bóng Mực phát hiện trong 12 m, bỏ đuổi ngoài 18 m; chạm vào thì −1 Ngọn Lửa (có 3), rơi một nửa số đom đóm, bất tử 1.5 s.
- Gió Lạc (Đêm 2–3) cướp tối đa 3 đom đóm khi bạn mang ≥ 5; Bùa Gió: 10 s chạy 7.2 m/s và Lướt không hồi chiêu.
- Đêm 1 / 2 / 3 dài **240 / 270 / 300 s**. **Thắng** khi còn sống tới bình minh và có ≥ 3/5, 4/6, 5/7 đèn đang sáng. Thắp đủ đèn không kết thúc Đêm sớm.
- **Điểm:** +5 mỗi đom đóm nạp/châm, +100 thắp lần đầu, +40 thắp lại, Tỏa Sáng +5 mỗi Bóng Mực (+15 nếu nó đang hút dầu); bình minh (khi thắng): +50 + dầu còn lại mỗi đèn sáng, +50 mỗi Ngọn Lửa.

Số có khóa tuning nằm trong [game.contract.json](game.contract.json) (game đọc thẳng file này); bản đồ chuẩn ở `src/core/maps.ts`. Spec: [Phase 2](docs/notes/spec-phase-2.md), [Ticket-03](docs/lab/TICKET-03.md); quyết định thiết kế: [ADR-001](docs/notes/adr-001-den-can-dau.md). Giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md).

## Chế độ headless (Test Contract v1.2)

Sau `npm ci && npm run build`:

```bash
node dist-headless/headless.mjs --seed 1 --night 2 --scenario tests/scenarios/p2-n2-pad.scenario.json --inputs tests/scenarios/p2-step-onto-pad.inputs.json --ticks 150 --out out.jsonl
```

- `--night` nhận 1, 2, 3. Logic 60 tick/giây, không cửa sổ, không GPU; một Đêm đầy đủ (21 600 tick) chạy khoảng 0.1 s.
- Output JSONL: `snapshot` (có `night`, `wind`, `player.vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s/capacity`, đèn `fuel/ever_lit/relit_count`, `motes`, `drifters`, `charms`), `event`, `end`.
- Cùng seed + scenario + inputs → output giống hệt (đã so sha256 giữa Windows và Linux).
- Mã thoát: 0 khi chạy xong; 2 khi file scenario/inputs sai định dạng; 1 khi tham số dòng lệnh sai.

## Test và kiểm chứng

```bash
npm test
```

```bash
npm run build:headless && npm run verify -- phase-3
```

- `npm test`: 66 test (luật Đêm 1, tính năng Phase 2, luật dầu đèn Phase 3, CLI headless thật), chạy dưới 1 giây.
- `npm run verify`: 26 scenario headless (mỗi tính năng mới ít nhất 1), chạy bằng đúng `headless_cmd`, mỗi cái 2 lần để kiểm tra tất định, ghi bằng chứng vào `docs/proof/<phase>/`.
- CI: [.github/workflows/ci.yml](.github/workflows/ci.yml) chạy typecheck, build, test, verify trên Ubuntu và macOS mỗi lần push.
- Bằng chứng: [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md) · [Phase 3](docs/proof/phase-3/README.md).

## Cấu trúc

```text
game.contract.json     Test Contract: lệnh + tuning (nguồn duy nhất của các con số)
src/core/              luật chơi thuần (không đồ họa), dùng chung cho game và headless
src/render/            Three.js + HUD + âm thanh, chỉ đọc trạng thái core
src/headless.ts        CLI headless
tests/                 test + scenarios/
scripts/               verify.mjs, make-bot-inputs.ts, hooks/
AGENTS.md, CLAUDE.md   hướng dẫn cho agent AI
.claude/               skill verify-phase, hook Stop chặn khi test đỏ
docs/notes/            giả định, nhật ký dùng AI, retro
docs/proof/            bằng chứng từng phase
docs/lab/              tài liệu gốc của lab
```

## Sáng tạo của tôi

Tất cả chỉ nằm ở phần hiển thị (`src/render/`), không đổi luật hay output headless (bằng chứng: 53 test và 18 scenario headless đạt; tắt phần hiển thị không ảnh hưởng headless vì headless không import `src/render`).

1. **Đèn Lồng Lớn dạng cột đèn** với 3 mức sáng: chưa nạp thì tắt hẳn, nạp dở thì kính ấm dần, đủ thì rực sáng kèm vùng sáng trên mặt đất.
2. **Cây cối và cảnh vật tự dựng:** bụi cây hoạt hình 3 cỡ, cây thông nhiều tầng, cây hoa anh đào, **cây cau** (Đảo Cau); **cầu gỗ Đêm 2** có bệ đá và 4 trụ đèn (mặt cầu phẳng, không lan can — đúng bản đồ chuẩn). Tất cả đặt tránh đường đi, đèn, điểm sinh đom đóm và bục nhảy.
3. **Lời Ông Đăng** ở màn giới thiệu từng Đêm; màn Bình Minh khi thắng cả 3 Đêm.
4. **Nhân vật và vật phẩm có hoạt cảnh** (giữ đúng bảng màu chuẩn): Mây đội **nón lá** có vòng nan và quai đỏ, áo choàng ngà `#E8E2D0`, khăn đỏ `#C8102E` bay theo bước chạy, cầm gậy đầu lửa (lửa to dần theo số đom đóm đang mang); đom đóm là **ngọn lửa nhỏ** (lõi `#FFF6C2`, quầng `#FFE58A`) có tàn lửa bay, **mỗi lần nhặt lóe sáng** quanh Mây; Đèn Lồng Lớn có **ngọn lửa bên trong kính** (nhỏ khi nạp dở, cháy to khi thắp sáng); Bóng Mực có mắt sáng và 8 xúc tu đung đưa, xoay vòng khi bị choáng; Gió Lạc là dải lụa uốn sóng quay theo hướng bay, mang đom đóm đã cướp; Bùa Gió có ký hiệu gió vàng và tua rua; bục nhảy là trống gỗ mặt lá sen với mũi tên vàng nhấp nháy.

## Giấy phép

[MIT](LICENSE). Nguồn tài nguyên: [CREDITS.md](CREDITS.md).
