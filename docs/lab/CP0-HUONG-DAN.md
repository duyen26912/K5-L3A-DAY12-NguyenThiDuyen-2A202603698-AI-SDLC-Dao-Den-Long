# Hướng dẫn Checkpoint 0 (CP0): Chuẩn bị

> **Thời lượng:** khoảng 10 phút, ở đầu giờ Phase 1 (nên làm trước buổi lab nếu được).
> **Mục tiêu:** có repo, môi trường, trợ giảng và chỗ ghi chép sẵn sàng để khi PRD-0 phát hành là bắt tay vào làm ngay.
> Nguồn: [CHECKPOINTS.md](CHECKPOINTS.md) mục Checkpoint 0, [SUBMISSION.md](SUBMISSION.md), [RULES.md](RULES.md) và tab Phase 1 trên [lab board](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW#p1). Tổng quan lab: [TONG-QUAN.md](TONG-QUAN.md).

---

## Checklist CP0 (5 việc)

- [ ] **1.** Repo GitHub cá nhân, **public**, đúng tên.
- [ ] **2.** Chọn công cụ AI, engine, ngôn ngữ; chạy thử "hello" 3D **và** headless.
- [ ] **3.** Đăng nhập claude.ai, mở lab board, hỏi trợ giảng tab Phase 1 một câu.
- [ ] **4.** Tạo sẵn chỗ ghi chép: giả định, nhật ký AI, bằng chứng.
- [ ] **5.** Xác nhận hạn nộp từng phase với Coach.

**Tự kiểm cuối CP0:** clone repo sang thư mục khác và chạy được chương trình thử.

---

## Bước 1. Repo GitHub

Tên bắt buộc theo quy ước Khóa 5:

```
K5-<L3A|L3B>-DAY12-<HoVaTen>-<MSSV>-AI-SDLC-Dao-Den-Long
```

Repo hiện tại đã đúng tên: `K5-L3A-DAY12-NguyenThiDuyen-2A202603698-AI-SDLC-Dao-Den-Long`, remote `origin` đã trỏ tới GitHub. Việc còn lại:

```bash
gh repo view --json visibility,name
```

Nếu `visibility` chưa là `PUBLIC`:

```bash
gh repo edit --visibility public --accept-visibility-change-consequences
```

Thêm `.gitignore` ngay từ đầu để không lỡ commit bí mật:

```gitignore
.env
.env.*
!.env.example
node_modules/
dist/
__pycache__/
*.log
```

## Bước 2. Chọn công nghệ và chạy "hello"

Không bắt buộc công nghệ, nhưng phải thỏa 3 điều kiện từ PRD-0 và Test Contract:

1. **Chạy được trên macOS hoặc Linux.** Bạn dùng Windows thì cần **bản web** hoặc **Docker** để giảng viên chạy được.
2. **Có chế độ headless** chạy logic game không cần cửa sổ/GPU, 60 tick/giây cố định, output JSONL **tất định**.
3. **Lệnh cài và chạy ngắn** (README tối đa 3 lệnh).

### Gợi ý stack (máy này đã có Node 26, Python 3.11, Docker, gh)

| Lựa chọn | Hiển thị 3D | Headless | Ghi chú |
|---|---|---|---|
| **TypeScript + Three.js + Vite** (gợi ý) | Trình duyệt | Cùng code logic chạy bằng Node | Một ngôn ngữ cho cả hai phần; chạy được mọi OS; dễ đóng gói bản web tĩnh cho Release |
| Python + Ursina/Panda3D | Cửa sổ desktop | Python thuần | Cần chú ý cài trên macOS/Linux |
| Godot | Engine | `--headless` | Mạnh nhưng tách logic để test JSONL tốn công hơn |

**Nguyên tắc kiến trúc quan trọng nhất:** tách `core/` (logic thuần, không import gì về đồ họa, nhận input theo tick, có RNG theo seed) khỏi `render/` (Three.js chỉ đọc trạng thái để vẽ). Headless và game có giao diện dùng **chung** `core/`.

### Hello thử (ví dụ với TypeScript + Three.js)

```bash
npm create vite@latest . -- --template vanilla-ts
```

```bash
npm install three && npm install -D @types/three tsx
```

- **Hello 3D:** sửa `src/main.ts` vẽ một khối lập phương xoay, chạy `npm run dev` và mở trình duyệt.
- **Hello headless:** tạo `src/headless.ts` chỉ cần đọc tham số `--ticks`, `--out` rồi ghi một dòng cuối đúng định dạng contract, ví dụ:

  ```json
  {"type":"end","ticks":60,"state":"playing","score":0}
  ```

  Chạy thử:

  ```bash
  npx tsx src/headless.ts --seed 1 --night 1 --ticks 60 --out out.jsonl
  ```

Mục tiêu ở CP0 chỉ là **chắc môi trường chạy**, chưa làm game.

### Chuẩn bị sẵn khung `game.contract.json`

Tạo file ở gốc repo theo mẫu Contract v1.0 (giá trị `tuning` điền sau khi có PRD-0 và tự chọn số):

```json
{
  "contract_version": "1.0",
  "team": "2A202603698-NguyenThiDuyen",
  "build_cmd": "npm ci",
  "run_cmd": "npm run dev",
  "headless_cmd": "npx tsx src/headless.ts",
  "tuning": {}
}
```

### Bạn dùng Windows: làm sao đáp ứng yêu cầu macOS/Linux?

PRD-0 mục 4 ghi rõ: nếu dùng Windows thì **phải có cách chạy trên macOS/Linux cho giảng viên, ví dụ Docker hoặc bản web**. Stack gợi ý ở trên đáp ứng yêu cầu này như sau:

| Phần | Vì sao chạy được trên macOS/Linux |
|---|---|
| Game có giao diện | Là **bản web** (Vite + Three.js): giảng viên chạy `npm run dev` hoặc mở bản build tĩnh trong trình duyệt ở bất kỳ OS nào |
| Headless | Chạy bằng **Node** (`npx tsx ...`), Node hoạt động giống nhau trên Windows/macOS/Linux |
| Kiểm chứng | Bạn **tự chạy thử trên Linux bằng Docker** (máy đã có Docker) trước mỗi lần gắn tag |

Bạn code trên Windows được, chỉ cần tránh mấy lỗi khiến bài chạy trên máy bạn nhưng hỏng trên máy giảng viên:

- **Không dùng lệnh chỉ có trên Windows** trong `build_cmd`, `run_cmd`, `headless_cmd` và README: không `.bat`/`.ps1`, không `set VAR=...`, không đường dẫn `C:\...` hay `\`. Chỉ dùng lệnh `npm`/`npx`/`node`.
- **Chú ý chữ hoa/thường trong tên file:** Windows không phân biệt nhưng Linux có. `import "./Player"` mà file là `player.ts` sẽ chạy trên Windows nhưng lỗi trên Linux.
- **Dùng `/` hoặc `path.join`** khi code đọc/ghi file (`--scenario`, `--out`).
- **Xuống dòng LF:** đặt `git config core.autocrlf input` và thêm `.gitattributes` có dòng `* text=auto eol=lf` để script và file JSONL không bị CRLF.
- **Tất định không phụ thuộc OS:** không dùng `Math.random()` hay thời gian thực trong `core/`, chỉ dùng RNG theo `--seed` và tick cố định.

Chạy thử trên Linux bằng Docker, **clone sạch từ GitHub** (giống hệt cách giảng viên làm, không đụng `node_modules` của Windows):

```bash
docker run --rm node:22 sh -c "git clone https://github.com/duyen26912/K5-L3A-DAY12-NguyenThiDuyen-2A202603698-AI-SDLC-Dao-Den-Long.git app && cd app && npm ci && npx tsx src/headless.ts --seed 1 --night 1 --ticks 60 --out out.jsonl && tail -n 1 out.jsonl"
```

Nếu lệnh in ra dòng `{"type":"end",...}` nghĩa là headless chạy được trên Linux. Đến Phase 4 có thể thêm `Dockerfile` vào Release để giảng viên có thêm một cách chạy dự phòng (không bắt buộc ở CP0).

## Bước 3. Lab board và trợ giảng

1. Mở [lab board](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW#p1) và **đăng nhập claude.ai** (chưa đăng nhập sẽ thấy "Sign in to see this artifact's data" và trợ giảng không chạy).
2. Mở tab **Phase 1** (các tab Phase 2–4 đang khóa).
3. Bấm **"Hỏi trợ giảng"**, hỏi thử một câu, ví dụ: *"Đơn vị của player_speed trong tuning là gì?"*
4. Ghi nhớ: trợ giảng dùng lượt Claude của bạn, trả lời ngắn, chỉ trong phạm vi phase đó. Nếu nó trả lời "chưa được quy định" thì đó là chỗ bạn **tự giả định và ghi lại**.

## Bước 4. Chỗ ghi chép và harness ban đầu

Dùng đúng **cấu trúc gợi ý của chương trình** trong [SUBMISSION.md mục 3](SUBMISSION.md) (không bắt buộc, nhưng theo đúng thì người chấm tìm bài dễ nhất). Phần chú thích bên phải cho biết mỗi mục chứa gì, áp vào stack TypeScript + Three.js:

```text
README.md                      link video ở đầu, cài/chạy ≤ 3 lệnh, điều khiển, test, headless, "Sáng tạo của tôi"
LICENSE  CREDITS.md  CHANGELOG.md
AGENTS.md                      (hoặc CLAUDE.md, .cursor/rules ...)
.agents/skills/ hoặc .claude/skills/     (skills, nếu có)
.claude/settings.json          (hooks, nếu có)
game.contract.json             bắt buộc theo Test Contract, ở gốc repo
src/                           (hoặc cấu trúc của engine bạn chọn)
  core/                        logic game thuần, không import three
  render/                      Three.js, chỉ đọc trạng thái để vẽ
  headless.ts                  lệnh headless theo Test Contract
tests/                         test đơn vị + scenarios/ (scenario + inputs headless tự viết)
docs/
  notes/        giả định, nhật ký dùng AI, retro
  proof/        bằng chứng từng phase (ví dụ proof/phase-1/)
  demo/         demo.mp4 (nếu không đính kèm Release)
```

Ở CP0 chỉ cần tạo khung: `README.md`, `AGENTS.md`, `game.contract.json` (bản nháp), `src/`, `tests/`, `docs/notes/`, `docs/proof/`. Còn `LICENSE`, `CREDITS.md`, `CHANGELOG.md`, skills, hooks và `docs/demo/` thêm dần ở các phase sau. Trong `docs/notes/` có thể chia thành `assumptions.md` (giả định), `ai-log.md` (nhật ký AI, token) và `retro.md`.

Git không lưu thư mục rỗng, nên đặt một file `.gitkeep` trong `docs/proof/` và `tests/` để các thư mục này được commit.

`AGENTS.md` khởi đầu nên ngắn (vài chục dòng), ví dụ:

```markdown
# AGENTS.md
- Stack: TypeScript + Three.js (render), src/core = logic thuần, không import three.
- Build: npm ci · Chạy: npm run dev · Test: npm test
- Headless: npx tsx src/headless.ts --seed <n> --night 1 --ticks <n> --out <file>
- Luôn bám Test Contract trong docs; không bịa yêu cầu. Chưa rõ thì hỏi, ghi giả định.
- Không commit .env / API key. Không sửa tay output để test đạt.
- Xong việc phải chạy test và headless, đưa output làm bằng chứng.
```

Mẫu đầu `docs/notes/ai-log.md`:

```markdown
| Phase | Công cụ/model | Việc giao | AI sai gì / cách phát hiện | Token/chi phí ước tính |
|---|---|---|---|---|
| CP0 | | Dựng khung dự án | | |
```

Commit ngay để lịch sử git cho thấy harness có từ đầu:

```bash
git add -A && git commit -m "CP0: project skeleton, AGENTS.md, notes, contract stub"
```

```bash
git push origin main
```

## Bước 5. Hạn nộp

| Mục | Hạn (tính theo giờ lab) |
|---|---|
| Tag `phase-1` | trước mốc 1h |
| Tag `phase-2` | trước mốc 2h |
| Tag `phase-3` | trước mốc 2h30 |
| Tag `phase-4`, Release `v1.0.0`, video | trước mốc 4h |
| Nộp link repo lên LMS | mặc định 23h59 cùng ngày (ca sáng) / 11h59 hôm sau (ca chiều), theo thông báo Coach |

Ghi giờ bắt đầu thực tế của buổi lab vào `docs/notes/` để tự canh mốc.

---

## Tự kiểm cuối CP0

```bash
git clone https://github.com/duyen26912/K5-L3A-DAY12-NguyenThiDuyen-2A202603698-AI-SDLC-Dao-Den-Long.git ../cp0-check
```

```bash
cd ../cp0-check && npm ci && npx tsx src/headless.ts --seed 1 --night 1 --ticks 60 --out out.jsonl
```

Đạt CP0 khi:

- [ ] Repo **public**, đúng tên, clone sạch được.
- [ ] Clone sạch chạy được hello 3D và hello headless (có file `out.jsonl` với dòng `end`).
- [ ] Lệnh Docker ở mục "Bạn dùng Windows" chạy được headless **trên Linux**.
- [ ] Đã mở được tab Phase 1 và trợ giảng trả lời.
- [ ] Có `AGENTS.md`, `docs/notes/`, `docs/proof/`, `.gitignore` đã commit và push.
- [ ] Biết hạn tag từng phase.

Xong CP0 → chuyển sang **CP1**: đọc PRD-0 hai lần, ghi giả định, điền `tuning`, thiết kế `core/` theo Test Contract.
