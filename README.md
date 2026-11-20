# Đảo Đèn Lồng

> **Video demo:** sẽ bổ sung ở Phase 4 (Release `v1.0.0`).
> Day 12 AI SDLC · Nguyễn Thị Duyên · 2A202603698 · Tài liệu lab: [docs/lab/](docs/lab/README.md)

Game 3D góc nhìn thứ ba. Bạn là **Mây**, người giữ đèn nhỏ tuổi, chạy khắp **Đảo Bến** nhặt đom đóm, mang về thắp lại **5 Đèn Lồng Lớn** và né **Bóng Mực** trong sương đen. Thắp hết đèn thì thắng; hết máu hoặc trời sáng thì thua.

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
| W A S D | Đi (theo hướng camera) |
| Kéo chuột / ← → | Xoay camera |
| Space | Nhảy |
| E | Nạp đom đóm vào đèn gần (trong 3 m) |
| Q | Tỏa sáng: tốn 1 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 6 m |
| R | Chơi lại (seed mới) |
| M | Tắt/bật âm thanh |

## Luật chơi và cách tính điểm

- Đom đóm tự nhặt khi đi tới gần (1.5 m), mang tối đa 5 con.
- Mỗi đèn cần 5 đom đóm. Đèn đã thắp tạo vùng an toàn bán kính 6 m mà Bóng Mực không vào được.
- Bóng Mực đuổi theo (4 m/s, chậm hơn Mây 6 m/s); chạm vào thì mất 1 máu (có 3), rơi một nửa số đom đóm đang mang và được bất tử 2 giây. Cứ 45 giây có thêm 1 Bóng Mực (tối đa 5).
- Đêm dài 300 giây.
- **Điểm:** +10 mỗi đom đóm nhặt, +100 mỗi đèn thắp, +20 mỗi Bóng Mực bị choáng; khi thắng cộng thêm +1 mỗi giây còn lại và +50 mỗi máu còn lại.

Mọi con số nằm trong `tuning` của [game.contract.json](game.contract.json) và game đọc thẳng file này. Giả định cho chỗ PRD-0 chưa nói: [docs/notes/assumptions.md](docs/notes/assumptions.md).

## Chế độ headless (Test Contract v1.0)

Sau `npm ci && npm run build`:

```bash
node dist-headless/headless.mjs --seed 1 --night 1 --scenario tests/scenarios/contract-example.scenario.json --inputs tests/scenarios/contract-example.inputs.json --ticks 300 --out out.jsonl
```

- Logic chạy 60 tick/giây cố định, không mở cửa sổ, không cần GPU; output JSONL gồm `snapshot`, `event`, `end`.
- Cùng seed + scenario + inputs → output giống hệt (đã so sha256 giữa Windows và Linux).
- Mã thoát: 0 khi chạy xong; 2 khi file scenario/inputs sai định dạng; 1 khi tham số dòng lệnh sai.

## Test và kiểm chứng

```bash
npm test
```

```bash
npm run build:headless && npm run verify -- phase-1
```

- `npm test`: 27 test (luật chơi + CLI headless thật), chạy dưới 1 giây.
- `npm run verify`: chạy các scenario trong `tests/scenarios/` bằng đúng `headless_cmd`, mỗi cái 2 lần để kiểm tra tất định, ghi bằng chứng vào `docs/proof/<phase>/`.
- CI: [.github/workflows/ci.yml](.github/workflows/ci.yml) chạy typecheck, build, test, verify trên Ubuntu và macOS mỗi lần push.
- Bằng chứng từng phase: [docs/proof/phase-1/](docs/proof/phase-1/README.md).

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

Tất cả chỉ nằm ở phần hiển thị (`src/render/`), không đổi luật hay output headless (bằng chứng: 27 test và 7 scenario headless vẫn đạt, output không đổi).

1. **La bàn đèn lồng:** mũi tên trên đầu màn hình chỉ tới đèn chưa thắp gần nhất, kèm gợi ý "Nhấn E để nạp…" khi đứng gần.
2. **Đom đóm quây quần quanh đèn đã thắp** và **đảo sáng dần lên** (trời chuyển từ tím đêm sang ấm hơn) theo số đèn đã thắp.
3. **Âm thanh tự tạo bằng WebAudio** cho nhặt đom đóm, nạp đèn, thắp đèn, tỏa sáng, bị chạm, thắng/thua (không dùng file âm thanh ngoài; tắt bằng M).
4. Bóng Mực co lại và đổi màu khi bị choáng; màn hình viền tím khi bị chạm; Mây nhấp nháy khi đang bất tử.

## Giấy phép

[MIT](LICENSE). Nguồn tài nguyên: [CREDITS.md](CREDITS.md).
