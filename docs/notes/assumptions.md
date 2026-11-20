# Giả định & tiêu chí nghiệm thu

## Phase 1 — PRD-0 + Test Contract v1.0

### Bắt buộc chính xác (lấy nguyên từ Test Contract)
- `game.contract.json` ở gốc repo; `tuning` khai đúng số game dùng → game **đọc thẳng** file này (`src/core/config.ts`), nên không thể lệch.
- Headless: `--seed --night 1 [--scenario] [--inputs] --ticks --out [--snapshot-every=10]`; 60 tick/s; dừng khi đủ tick hoặc hết game; thoát 0; lỗi định dạng file → 2; lỗi khác → khác 0, báo stderr.
- Tick model: snapshot tick 0 = sau dựng scenario, trước input; bước k đọc input tick k → trạng thái k+1, sự kiện ghi `tick = k+1`; `time_left_s = thời lượng − số bước / 60`.
- Inputs: mặc định `move [0,0]`, `cam_yaw_deg 0`, nút false; frame chỉ đổi trường có mặt; tick tăng nghiêm ngặt; move mỗi thành phần ∈ [−1, 1], chuẩn hóa nếu dài > 1; công thức xoay theo θ; nút kích hoạt khi false → true.
- Scenario: `lanterns` cập nhật theo id; `motes`, `shades` thay danh sách; `random_*: false` tắt tự sinh; dựng scenario không phát sự kiện, không cộng điểm.
- Output: snapshot / event / end; tọa độ làm tròn 3 chữ số; tất định theo seed.

### Giả định cho chỗ PRD-0 chưa nói (số đã khai trong `game.contract.json`)

| # | Chỗ mơ hồ | Giả định của bài |
|---|---|---|
| A1 | Kích thước đảo, vị trí đèn | Đảo tròn bán kính 40 m. 5 đèn L1…L5 cách đều trên vòng tròn bán kính 25 m, Lk tại góc a = (k−1)·72°, vị trí (25·sin a, 0, 25·cos a): L1 = (0, 0, 25), L2 ≈ (23.776, 0, 7.725)…. Người chơi xuất phát (0, 0, 0). |
| A2 | Rơi khỏi đảo | Không rơi được: người chơi bị giữ trong bán kính đảo → `fall_enabled: false`, không bao giờ có `player_hit` với `by: "fall"`. |
| A3 | Nhặt đom đóm | Tự động khi khoảng cách XZ ≤ `pickup_radius` (1.5 m) và còn chỗ (`carry_capacity` 5). Đom đóm trên mặt đất (y = 0). Mỗi con +`per_mote` (10) điểm khi nhặt. |
| A4 | Nạp đèn | Nhấn interact khi cách đèn **chưa thắp** gần nhất ≤ `interact_radius` (3 m): nạp `min(đang mang, còn thiếu)`. Đủ `lantern_cost` (5) → thắp, +`per_lantern` (100). Đèn đã thắp không nhận thêm. |
| A5 | Tỏa sáng tốn gì | Tốn `pulse_cost` = 1 đom đóm đang mang ("tốn ánh sáng"). Không đủ đom đóm hoặc đang hồi chiêu (`pulse_cooldown_s` 2 s) → không có gì xảy ra, không phát sự kiện. |
| A6 | Hiệu ứng tỏa sáng | Mọi Bóng Mực có khoảng cách XZ ≤ `pulse_radius` (6 m) bị choáng `pulse_stun_s` (3 s), bị đẩy ra xa `pulse_push_m` (4 m) theo hướng từ người chơi, +`per_stun` (20)/con. Sự kiện `pulse` luôn phát khi tỏa sáng thành công, kể cả `stunned_ids` rỗng. |
| A7 | Bóng Mực | Ban đầu 2 con (S1, S2) ở mép đảo (r = 36 m), cao 1 m (tâm). Luôn đuổi thẳng tới người chơi với `shade_speed` 4 m/s (chậm hơn người chơi 6 m/s). Thêm 1 con mỗi 45 s (tối đa 5) → `shade_spawned`. Trạng thái: `chase`, `stunned`. |
| A8 | "Bóng Mực sợ đèn" | Không vào được vùng `safe_radius` (6 m) quanh đèn **đã thắp**; đèn chưa thắp không bảo vệ. |
| A9 | Bị chạm | Bóng Mực không choáng cách ≤ `shade_hit_radius` (1 m): −1 flame, rơi `floor(carried × hit_drop_ratio)` (0.5) đom đóm xuống đất quanh người chơi, cách 3 m; bất tử `invuln_s` (2 s). |
| A10 | Thắng / thua | Thắp đủ 5 đèn → `won` / `all_lit`. Hết flames → `lost` / `no_flames`. Hết thời gian đêm (`night1_duration_s` 300 s) → `lost` / `dawn`. |
| A11 | Điểm khi thắng | Cộng thêm `per_second_left × floor(time_left_s)` + `per_flame_left × flames` (1 và 50) tại lúc thắng. Thua thì không cộng thưởng. |
| A12 | Đom đóm ngẫu nhiên | Ban đầu 24 con rải đều trên đảo (r 4…38 m); cứ 3 s sinh thêm 1 con nếu đang < 24. |
| A13 | Nhảy | Vận tốc 7 m/s, trọng lực 20 m/s². Nhảy không ảnh hưởng va chạm (mọi khoảng cách đo theo mặt phẳng XZ như contract). |
| A14 | `dash` | Phase 1 không có dash; trường `dash` trong inputs được chấp nhận nhưng không có tác dụng. |
| A15 | id | Đèn `L1…L5`; Bóng Mực `S1, S2…`; đom đóm `M1, M2…`. Thực thể trong scenario không có id được đặt id theo thứ tự từ 1; thực thể sinh sau tiếp tục đánh số. |
| A16 | Scenario `lit: true` không kèm `deposited` | Coi như `deposited = lantern_cost`. |
| A17 | Snapshot | Ngoài trường bắt buộc, có thêm mảng `motes` (`id`, `pos`) như contract khuyến nghị. Không thêm snapshot cuối ngoài lịch `--snapshot-every`. |

### Tiêu chí nghiệm thu (mỗi dòng có test/scenario tương ứng, xem `docs/proof/phase-1/README.md`)
1. Chạy `node dist-headless/headless.mjs ...` theo đúng contract → file JSONL hợp lệ, dòng cuối `end`, thoát 0.
2. File đầu vào sai định dạng → thoát 2.
3. Cùng seed + scenario + inputs → output giống hệt (kể cả giữa Windows và Linux).
4. Đi theo `move` + `cam_yaw_deg` đúng công thức và đúng `player_speed`.
5. Nhặt / nạp / thắp / tỏa sáng / bị chạm / thắng / thua phát đúng sự kiện và đúng điểm theo `tuning`.
6. Game có giao diện: chơi được từ đầu đến thắng hoặc thua, có HUD, nhấn R chơi lại.


## Phase 2 — Ticket-02 + Test Contract v1.1

Ticket-02 thay toàn bộ số tự chọn của Phase 1 bằng số chuẩn (xem `docs/notes/spec-phase-2.md`). Các giả định A1–A17 ở trên bị thay như sau.

### Giả định Phase 1 bị bỏ hoặc thay (kèm lý do)
| Phase 1 | Phase 2 | Lý do |
|---|---|---|
| A1 vị trí đèn tính bằng công thức (L2 = 23.776, 7.725) | Đèn đúng tọa độ ticket (L2 = 23.8, 7.7) | Bản đồ chuẩn |
| A2 không rơi khỏi đảo (`fall_enabled: false`) | Rơi được, có luật rơi | Ticket-02 |
| A3 nhặt 1.5 m, mang 5, +10 khi **nhặt** | 1.0 m + chênh cao 1.5 m, mang 10, +10 khi **nạp** | Điểm chuẩn hóa |
| A4 đèn cần 5, bán kính 3 m | 10, bán kính 2 m, bằng nhau chọn id nhỏ | Số chuẩn |
| A5–A6 tỏa sáng tốn 1, 6 m, choáng 3 s, +20 | 3 đom đóm, 5 m (3D từ chân + 0.8), 120 tick, +5 | Số chuẩn |
| A7 2 Bóng Mực lúc bắt đầu, thêm mỗi 45 s, luôn đuổi | Không có lúc bắt đầu; 2 con tại tick 300, rồi theo khoảng sinh; phát hiện 12 m / bỏ đuổi 18 m | Số chuẩn |
| A9 bất tử 2 s, rơi đom đóm cách 3 m | 90 tick, rơi ra vành 1.5–2.5 m, TTL 480 | Số chuẩn |
| A10 thắng xét ngay khi thắp đèn cuối | Xét sau mỗi tick theo thứ tự no_flames → all_lit → dawn | Thứ tự tick chuẩn |
| A11 thưởng 1×giây + 50×lửa | 2×giây + 50×lửa | Số chuẩn |
| A12 24 đom đóm, sinh mỗi 3 s | 20 ở 20 điểm sinh khác nhau, sinh tick 240k, trần 30 | Số chuẩn |

Các test Phase 1 bị luật mới làm sai đã được **sửa theo luật mới** (không tắt): xem `tests/core.test.ts` (đầu file ghi rõ). Scenario `light-last-lantern` đổi `carried` 5 → 10 vì đèn cần 10. Bot thắng Đêm 1 cũ (seed 2026) không còn thắng với số chuẩn → thay bằng bot mới thắng seed 5.

### Giả định mới cho chỗ Ticket-02 chưa nói
| # | Chỗ chưa rõ | Giả định |
|---|---|---|
| B1 | Điểm xuất phát Đêm 2, Đêm 3 | Đêm 2: (0,0,0) tâm đảo A. Đêm 3: (0,0,−30) trên tầng 0 (tâm (0,0,0) nằm trong tháp chuông) — quay mặt +Z |
| B2 | Thời gian ở trạng thái `spawning` | Đúng 1 tick (tick sinh ra); từ tick sau là wander/chase và mới chạm được ("thực thể mới chỉ tương tác được từ tick sau") |
| B3 | Bóng Mực đi lại thế nào ở Đêm 2–3 | Bay lơ lửng tâm cao 1 m trên mặt đất bên dưới, không bị vách chặn, không bay ra khoảng không (biển mây) và không xuyên tháp; wander 1.5 m/s tới điểm sinh đom đóm ngẫu nhiên |
| B4 | "Chênh cao" khi chạm Bóng Mực | Tâm Bóng Mực so với chân Mây ≤ 1.5 m |
| B5 | "Điểm sương" sinh Gió Lạc | Dùng điểm sinh Bóng Mực của Đêm đó, chọn ngẫu nhiên theo seed |
| B6 | Gió Lạc idle "lượn chậm" | Bay vòng tròn 2 m/s, cao 1.2 m, quay vào trong khi gần mép |
| B7 | Gió Lạc ở trạng thái `removed` | Vẫn giữ trong mảng `drifters` với `state: "removed"` (không còn tương tác); không tính vào giới hạn 2 con |
| B8 | Hướng gió | Góc nguyên 0–359° theo seed, `wind.dir_deg` = null khi không có gió; cơn gió đầu tại tick 1800 |
| B9 | `player.invuln` trong snapshot | Boolean (còn bất tử hay không); các bộ đếm khác là giây (`*_s`) |
| B10 | Bậc đi lên được (dốc) | Chênh ≤ 0.4 m mỗi bước đi được; cao hơn là vách |
| B11 | Nạp đèn ở các tầng | XZ ≤ 2 m và chênh cao chân Mây – chân đèn ≤ 1.5 m |
| B12 | Scenario `charms[]` | Nhận `id`, `pos`, `available`, `respawn_ticks`; scenario `motes[]` nhận thêm `kind` |
| B13 | "Tăng tốc/dừng ≤ 0.1 s" | Vận tốc đổi tức thời (0 tick) — thỏa ≤ 0.1 s |
