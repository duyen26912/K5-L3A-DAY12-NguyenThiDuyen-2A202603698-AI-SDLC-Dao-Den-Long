# Tổng quan: Lab này làm gì?

> Tóm tắt từ các file trong repo ([README](README.md), [GUIDE](GUIDE.md), [CHECKPOINTS](CHECKPOINTS.md), [SUBMISSION](SUBMISSION.md), [RULES](RULES.md), [RUBRIC](RUBRIC.md)) và tab Phase 1 trên **[lab board Đảo Đèn Lồng](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW#p1)**.
> Hướng dẫn chuẩn bị chi tiết: [CP0-HUONG-DAN.md](CP0-HUONG-DAN.md).

---

## 1. Một câu tóm tắt

Trong **4 giờ**, mỗi người tự **dùng AI (Claude Code, Cursor, Codex…) theo quy trình SDLC** để xây một **game 3D tên "Đảo Đèn Lồng"** qua **4 phase**. Yêu cầu được "khách hàng" phát hành dần trên lab board và có thể thay đổi giữa chừng. Điểm không nằm ở game đẹp hay phức tạp, mà ở chỗ **làm đúng yêu cầu, chứng minh được là đúng, và dẫn dắt AI có quy trình**.

## 2. Game "Đảo Đèn Lồng" là gì?

- Bạn điều khiển **Mây**, người giữ đèn nhỏ tuổi (đội nón lá có treo đèn lồng nhỏ), trên một hòn đảo giữa biển mây bị sương đen nuốt mất ánh sáng.
- Mây chạy khắp đảo **nhặt đom đóm**, mang về **nạp vào các Đèn Lồng Lớn** để thắp sáng lại.
- **Bóng Mực** (sinh vật mực đen) đuổi theo; bị chạm thì **mất máu (flames)**. Mây có thể **tỏa sáng (pulse)** để xua chúng, nhưng tốn ánh sáng. Bóng Mực **sợ đèn**.
- **Thắp hết đèn → thắng. Hết máu → thua.** Có điểm số.
- Phong cách: đêm, ấm áp, cổ tích; đồ họa đơn giản nhưng đẹp; ánh sáng vàng cam = tốt, tím đen = nguy hiểm; không bạo lực.

### Phạm vi Phase 1 (PRD-0)

- 1 màn: **Đêm 1 – Đảo Bến**, đảo tròn có **5 Đèn Lồng Lớn** (L1…L5).
- Đi lại, nhảy, camera 3D góc nhìn thứ ba.
- Đom đóm rải rác, nhặt được; nạp vào đèn để thắp.
- Bóng Mực xuất hiện và đuổi; tỏa sáng để xua.
- Thắng/thua, điểm, HUD; chơi lại được.

## 3. Bốn phase và lịch 4 giờ

| Mốc | Phase | Tài liệu nhận | Phải nộp trước |
|---|---|---|---|
| 0h → 1h | **Phase 1** (gồm CP0 chuẩn bị ~10 phút) | PRD-0 + **Test Contract v1.0** | tag `phase-1` trước 1h |
| 1h → 2h | **Phase 2** | Ticket-02 | tag `phase-2` trước 2h |
| 2h → 2h30 | **Phase 3** (chỉ 30 phút) | Ticket-03 (có thể **thay luật cũ**) | tag `phase-3` trước 2h30 |
| 2h30 → 4h | **Phase 4** | Ticket-04 (hiệu năng, phát hành) | tag `phase-4` + Release `v1.0.0` + video trước 4h |

Hết giờ phase thì **gắn tag và đi tiếp**, kể cả khi chưa xong; phần chưa xong ghi trung thực.

## 4. "Test Contract" – phần quan trọng nhất về kỹ thuật

Giảng viên chấm tự động 30 điểm bằng **kịch bản ẩn** chạy qua **chế độ headless** (không cửa sổ, không GPU). Vì vậy game phải **tách logic khỏi phần hiển thị**. Tóm tắt Contract v1.0:

1. **`game.contract.json` ở gốc repo**: khai báo `team`, `build_cmd`, `run_cmd`, `headless_cmd` và khối `tuning` (tốc độ, sức chứa, bán kính nhặt/tương tác, chi phí pulse, thời lượng đêm, số flames, điểm cho từng sự kiện…). Số trong `tuning` **phải đúng số game đang dùng** (không có thì để `null`/`false` và giải thích trong README).
2. **Lệnh headless**:
   ```
   <headless_cmd> --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>]
                  --ticks <int> --out <file.jsonl> [--snapshot-every <int, mặc định 10>]
   ```
   Chạy **60 tick/giây cố định**, chạy đủ N tick hoặc tới khi thắng/thua; thoát mã 0; file sai định dạng → mã 2.
3. **File inputs**: danh sách frame theo tick (`move`, `cam_yaw_deg`, `jump`, `interact`, `pulse`…); nút kích hoạt khi chuyển false → true.
4. **File scenario**: dựng sẵn tình huống (vị trí người chơi, đom đóm, Bóng Mực, đèn, thời gian còn lại) để test.
5. **Output JSONL**: dòng `snapshot` định kỳ, dòng `event` (`mote_picked`, `deposit`, `lantern_lit`, `pulse`, `player_hit`, `shade_spawned`, `game_over`) và dòng cuối bắt buộc `end`.
6. **Tất định**: cùng seed + scenario + inputs → output **giống hệt** giữa hai lần chạy. Tọa độ làm tròn 3 chữ số; trục Y hướng lên; đơn vị mét.

Contract có thể được cập nhật ở các phase sau → cần chạy lại scenario cũ mỗi phase.

## 5. Mỗi phase làm theo vòng SDLC nhỏ

1. **Requirements** – đọc yêu cầu, tách "bắt buộc" vs "mơ hồ", ghi giả định.
2. **Plan** – nghĩ cách kiểm chứng **trước** khi để agent code.
3. **Build** – agent viết, bạn điều phối và đọc diff; commit nhỏ.
4. **Verify** – chạy thật, lưu bằng chứng (test, output headless, ảnh, số đo). *"Agent bảo chạy rồi" không phải bằng chứng.*
5. **Evaluate** – cái gì đạt, AI sai ở đâu, harness cần chỉnh gì, tốn bao nhiêu token.
6. **Release** – gắn tag `phase-N`, push.

## 6. Bàn giao cuối cùng (repo GitHub public)

- Mã nguồn qua 4 phase, tag `phase-1`…`phase-4`, Release `v1.0.0` có bản chạy được.
- `README.md`: link video ở đầu, cài và chạy **≤ 3 lệnh**, điều khiển, cách chạy test + headless, mục **"Sáng tạo của tôi"**.
- `game.contract.json` + chế độ headless.
- **Bằng chứng** từng phase (khớp mã ở tag).
- **Harness AI**: `AGENTS.md`/`CLAUDE.md`, skills, hooks… giữ nguyên trong lịch sử git.
- **Ghi chép**: giả định, nhật ký dùng AI (có ước tính token/chi phí), retro.
- **Video `.mp4` < 5 phút**, `CREDITS.md`, `LICENSE`. Không commit `.env`/API key.

## 7. Chấm điểm (100)

| Hạng mục | Điểm |
|---|---:|
| A. Test tự động ẩn (headless, kiểm tra lại cả phase trước) | 30 |
| B. Kiểm chứng & bằng chứng của bạn | 20 |
| C. Quy trình SDLC & harness AI | 15 |
| D. Evaluation & retro (gồm dùng token) | 10 |
| E. Hiệu năng & ổn định | 10 |
| F. Chất lượng sản phẩm (6) + sáng tạo (4) | 10 |
| G. Video demo | 5 |

## 8. Những điều dễ mất điểm

- Thiếu tag/Release hoặc tag sau hạn.
- Khai `tuning` sai so với game → trượt test ẩn.
- Output headless không tất định hoặc sai định dạng.
- Bằng chứng giả (test luôn đạt, sửa tay output) → vi phạm nghiêm trọng.
- Xóa file harness, force push sau khi đã tag, lộ API key.
- Chỉ chạy được trên Windows: game **phải chạy được trên macOS/Linux** (Docker hoặc bản web là cách an toàn).
