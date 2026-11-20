# Spec Phase 2 — Ticket-02 "Ba hòn đảo" (Contract v1.1)

Tài liệu này là acceptance criteria (AC) cho Ticket-02. Mỗi AC có cách kiểm chứng: **T** = test trong `tests/` (`npm test`), **S** = scenario headless chạy bằng `npm run verify -- phase-2` (kết quả ở `docs/proof/phase-2/headless-verify.md`), **G** = kiểm tra trên giao diện (ảnh chụp, chơi thử).

## Phần 1 — Số liệu chuẩn (thay mọi số tự chọn của Phase 1)

| # | Acceptance criteria | Kiểm chứng |
|---|---|---|
| N1 | `game.contract.json` có `contract_version: "1.1"`, tuning đúng số chuẩn, thêm `dash_*`, `night2/3_duration_s` | T `contract v1.1` |
| N2 | Chạy 6 m/s theo hướng camera (dừng/tăng tốc tức thời, đạt "≤ 0.1 s"); điều khiển trên không đầy đủ | T `di chuyển` |
| N3 | Nhảy 7 m/s, trọng lực 20 m/s², chỉ khi chạm đất | T `nhảy` |
| N4 | Nhặt XZ ≤ 1.0 m và chênh cao ≤ 1.5 m; sức chứa 10 | T `nhặt` |
| N5 | 20 đom đóm lúc đầu ở 20 điểm khác nhau; tick 240, 480… thêm 1 ở điểm trống nếu < 30 | T `Đêm 1: bản đồ chuẩn`, `lịch sinh đom đóm` |
| N6 | Đèn cần 10, nạp nhiều lần, chọn đèn chưa sáng gần nhất (bằng nhau → id nhỏ hơn), bán kính 2 m | T `nạp đèn` (3 test) |
| N7 | Vùng an toàn 6 m: chặn ở mép; bóng đang ở trong khi đèn vừa thắp bị đẩy ra ≤ 30 tick, không gây sát thương | T `vùng an toàn` (2 test), S `p2-safe-evict` |
| N8 | Tỏa Sáng: 3 đom đóm, tâm chân + 0.8 m, 3D ≤ 5 m, choáng 120 tick, đẩy 4 m trong 15 tick, hồi chiêu 3 s, pulse lại làm mới | T `Tỏa Sáng` (2 test), `choáng hết 120 tick` |
| N9 | Bóng Mực 4 m/s (Đêm 3: 4.5), phát hiện 12 m / bỏ đuổi 18 m; trạng thái spawning/wander/chase/recoil/stunned | T `wander → chase`, `regression trạng thái v1.1` |
| N10 | Chạm XZ ≤ 1 m và chênh cao ≤ 1.5 m; tối đa 1 lần mất Ngọn Lửa/tick; bóng lùi 2 m trong 60 tick; chạm lúc bất tử không làm gì | T `bị đánh`, `tối đa 1 lần` |
| N11 | Bị đánh: −1 Ngọn Lửa, rơi floor(mang/2) ra vành 1.5–2.5 m (TTL 480, nhặt lại từ tick sau), bất tử 90 tick | T `bị đánh`, `đom đóm rơi` |
| N12 | Lịch sinh Bóng Mực: 2 con tại tick 300 rồi mỗi khoảng sinh (8 / 7 / 6 s), điểm cách người chơi ≥ 15 m, tối đa 6 / 8 / 10 | T `lịch sinh Đêm 1`, S `p2-n2-random-full`, `p2-n3-random-full` |
| N13 | Thời gian 300 / 330 / 360 s; thắng/thua xét sau mỗi tick (no_flames > all_lit > dawn; thắng kể cả đúng tick hết giờ) | T `thắng kể cả đúng tick hết giờ`, `hết Ngọn Lửa`, S `p1-dawn` |
| N14 | Điểm: +10 mỗi đom đóm **nạp**, +100 mỗi đèn, +5 mỗi Bóng Mực trúng Tỏa Sáng, thắng + floor(giây còn lại)×2 + 50×Ngọn Lửa | T `nạp đèn`, `thắng`, `Tỏa Sáng` |
| N15 | Thứ tự xử lý một tick đúng 12 bước của ticket | Mã `src/core/world.ts` hàm `step` theo đúng thứ tự, có chú thích từng bước |

## Phần 2 — Bản đồ chuẩn

| # | Acceptance criteria | Kiểm chứng |
|---|---|---|
| M1 | Đêm 1: đảo r = 40, đèn và điểm sinh đúng tọa độ ticket | T `Đêm 1: bản đồ chuẩn` |
| M2 | Đêm 2: 2 đảo r = 28 + cầu tre x ∈ [26, 44], z ∈ [−2, 2]; ra khỏi cầu thì rơi | T `Đêm 2: đi qua cầu`, S `p2-n2-bridge` |
| M3 | Đêm 2: bục nhảy 14 m/s lên + 24 m/s ngang về tâm đảo kia, giữ tới khi chạm đất, đáp trong đảo đích | T, S `p2-n2-pad` |
| M4 | Đêm 3: tầng 0/1/2, vách không leo được, bước ra mép thì rơi xuống tầng dưới, 2 dốc 30°/150° | T `vách`, `mép tầng`, S `p2-n3-ramp` |
| M5 | Đêm 3: bục (0,3,13) → tầng 2; tháp chuông r = 2 chặn | T, S `p2-n3-pad` |
| M6 | Đêm 3: gió mỗi 30 s kéo dài 5 s, 2 m/s, báo trước 2 s (lá bay + âm thanh) | T `gió mạnh`, S `p2-n3-wind`, G lá bay + chữ "Gió sắp nổi…" |

## Phần 3 — Tính năng mới

### Lướt
- AC-D1: nhấn Lướt (false → true) → 14 m/s trong 12 tick theo hướng di chuyển, đứng yên thì theo hướng quay mặt; sự kiện `dash {}`. (T, S `p2-dash`)
- AC-D2: hồi chiêu 1.5 s tính từ lúc bắt đầu; nhấn sớm bị bỏ qua. (T, S `p2-dash`)
- AC-D3: lướt trên không giữ nguyên độ cao; không bất tử khi lướt. (T)

### Rơi khỏi đảo
- AC-F1: Y < −10 → `player_hit {by: "fall", lost}`, −1 Ngọn Lửa, mất toàn bộ đom đóm, bỏ qua bất tử. (T, S `p2-fall`)
- AC-F2: chờ 60 tick (không nhặt, không bị chạm) rồi hồi sinh ở điểm xuất phát, vận tốc 0, bất tử 90 tick. (T, S `p2-fall`)
- AC-F3: hết Ngọn Lửa thì thua ngay, không hồi sinh. (T)

### Gió Lạc (Đêm 2, 3)
- AC-W1: sinh tại tick 1200, 2400… tối đa 2 con, id D1, D2…; Đêm 1 không có. (T)
- AC-W2: idle → chase khi Mây mang ≥ 5 và cách ≤ 15 m; điều kiện mất thì về idle. (T)
- AC-W3: chạm XZ ≤ 1.2 m → cướp min(3, mang), `drifter_steal`, chuyển flee 240 tick rồi removed; mỗi con chỉ cướp 1 lần; không làm mất Ngọn Lửa; bất tử không ngăn. (T, S `p2-drifter-steal`)
- AC-W4: Tỏa Sáng trúng lúc chase → flee không cướp; trúng lúc flee có mang → thả lại thành đom đóm rơi, `drifter_drop`, biến mất sau 120 tick. (T, S `p2-drifter-drop`)
- AC-W5: vùng an toàn không chặn Gió Lạc. (thiết kế: Gió Lạc không xét vùng an toàn)

### Bùa Gió
- AC-C1: nhặt như đom đóm → `charm_picked {charm_id, charm_ticks: 600}`; nhặt lại làm mới. (T, S `p2-charm`)
- AC-C2: trong hiệu lực: chạy 7.2 m/s, Lướt không hồi chiêu (vẫn phải nhấn lại; nhấn khi đang lướt bị bỏ qua). (T, S `p2-charm`)
- AC-C3: xuất hiện lại sau 2700 tick; vị trí Đêm 2 (35,0,0), Đêm 3 (30,0,25) và (−30,0,25). (T)

### Chuỗi 3 Đêm
- AC-S1: Menu chính → giới thiệu Đêm (tên đảo, lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. (G)
- AC-S2: thắng Đêm 3 → màn Bình Minh với tổng điểm (tổng điểm các Đêm đã thắng). (G, mã `endNight`)
- AC-S3: thua → được chơi lại Đêm đó. (G)

### Tạm dừng
- AC-P1: Esc/P → logic dừng hoàn toàn: tick tăng, sim_tick/thời gian/hồi chiêu/spawn/TTL đứng yên; snapshot `state: "paused"`; sự kiện `paused`/`resumed`. (T, S `p2-pause`, G)
- AC-P2: menu tạm dừng có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu. (G)

### Cài đặt
- AC-O1: âm lượng và độ nhạy chuột, lưu `localStorage` giữa các lần mở game. (G)

### Âm thanh
- AC-A1: nhạc nền đêm + hiệu ứng nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối. (G, mã `src/render/sfx.ts`)

### HUD
- AC-H1: Ngọn Lửa trên trái; đồng hồ mm:ss trên giữa (đỏ + nhấp nháy khi ≤ 30 s); đèn k/n + điểm trên phải; thanh 10 ô dưới giữa; biểu tượng hồi chiêu Lướt + Tỏa Sáng dưới phải; nhắc "E — Nạp ánh sáng (x/10)"; mũi tên tới đèn chưa sáng gần nhất khi ở ngoài màn hình. (G ảnh chụp)

### Bảng màu chuẩn
- AC-K1: các thành phần liệt kê dùng đúng mã màu (`src/render/palette.ts`); ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng đèn). (mã)

### Test Contract v1.1
- AC-T1: `--night 1|2|3`; snapshot có `night`, `wind`, `player.vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s`, mảng `motes/drifters/charms`. (T)
- AC-T2: scenario nhận `player.*_ticks`, `shades[].state/state_ticks_left`, `drifters`, `charms`, `random_drifters`, `wind_enabled`. (T)
- AC-T3: input `dash`, `pause` kích hoạt khi false → true. (T)
- AC-T4: một Đêm đầy đủ (≤ 21 600 tick) chạy ≤ 30 s. (T `hiệu năng`, S `p2-n*-random-full`: ~0.1 s)

### Hiệu năng hiển thị
- AC-R1: ≥ 30 FPS trung bình ở 1280×720. (G: bật bộ đếm bằng F3 hoặc `?fps=1`; xem bằng chứng)
