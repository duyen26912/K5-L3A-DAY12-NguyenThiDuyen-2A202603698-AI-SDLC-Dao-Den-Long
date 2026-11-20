# Retro — Đảo Đèn Lồng (4 phase, Release v1.0.0)

Nguyễn Thị Duyên · 2A202603698 · công cụ AI: Claude Code (Claude Opus 5.5). Chi tiết từng bước: [ai-log.md](ai-log.md). Bằng chứng: `docs/proof/phase-1` … `phase-4`.

## 1. Evaluation 4 phase

| Phase | Phạm vi | Kết quả đo được | Chưa đạt / rủi ro còn lại |
|---|---|---|---|
| 1 — PRD-0, contract v1.0 | Đêm 1, đom đóm, Bóng Mực, Tỏa Sáng, HUD, headless JSONL tất định | 27 test, 7 scenario; output trùng từng byte Windows ↔ Linux | Chưa chơi tay trọn đêm trên giao diện lúc tag |
| 2 — Ticket-02, v1.1 | Số chuẩn, thứ tự tick 12 bước, 3 bản đồ, Lướt, Tạm dừng, Rơi, Gió Lạc, Bùa, gió | 53 test, 18 scenario; luật Phase 1 bị thay được sửa test kèm lý do | Bot chỉ thắng Đêm 1 |
| 3 — Ticket-03, v1.2 | Dầu đèn, `drain`, thắng ở bình minh, sức chứa, điểm mới, chế độ mù màu | 66 test, 26 scenario; ADR-001; bảng breaking changes | Bot chưa thắng Đêm nào với luật dầu; độ khó chưa cân bằng bằng chơi tay |
| 4 — Ticket-04, v1.3 | Bench, soak, bảng xếp hạng, đổi phím, phụ đề, giảm chuyển động, cỡ chữ, phát hành | 83 test, 27 scenario; 26/26 output giống hệt phase-3; bench avg 186 / p1_low 84.7 FPS / load 1.2 s; soak ×1.06 (Win), ×1.04 (Linux) | Bench chưa đo trên macOS/Linux có màn hình; video demo do mình tự quay |

## 2. Điều hiệu quả khi làm với AI

- **Tách `core` thuần ngay từ Phase 1.** Mọi luật có test chạy dưới 1 giây và cùng một hàm cho cả game lẫn headless. Ba lần luật đổi (Phase 2, 3) chỉ phải sửa `core` + test; Phase 4 thêm cả benchmark mà đầu ra headless không đổi một byte.
- **Kiểm chứng bằng chạy thật thay vì tin lời AI.** Các lỗi đáng kể đều lộ ra khi chạy: đọc JSONL, Docker Linux, script đo cỡ chữ, `slowest_ms` của bench. Không lỗi nào lộ ra nhờ "AI nói đã xong".
- **Giao việc theo lát mỏng có tiêu chí đo được** (một luật → một test + một scenario) thì AI làm đúng ngay. Giao "làm đẹp giống game X" thì AI làm quá phạm vi (Phase 1 phải hoàn tác).
- **Ghi giả định thay vì đoán ngầm:** 50+ mục trong `assumptions.md` giúp không phải tranh luận lại cùng một chỗ mơ hồ ở phase sau.

## 3. Điều không hiệu quả

- Khung trình duyệt của công cụ hay bị ẩn → game ngừng vẽ, AI không tự chơi thử được; tốn token chụp ảnh để "đẩy" khung hình. Phase 4 chuyển sang Playwright headless thì ổn định hơn nhiều.
- Bot tự động chơi để làm bằng chứng tốn công nhưng hiệu quả giảm dần khi luật khó lên (Phase 3–4 không thắng được). Scenario dựng sẵn trạng thái kiểm luật tốt hơn.
- Làm phase mới chồng lên phase cũ chưa commit (Phase 3) suýt làm sai tag.

## 4. Những lần AI sai và cách phát hiện

| Lỗi | Phát hiện bằng |
|---|---|
| Đếm id Bóng Mực sai khi scenario thay danh sách; lệch 1 tick choáng/hồi chiêu | Đọc output ví dụ contract; test thời gian choáng |
| Test CLI chỉ chạy được trên Windows (esbuild là binary trên Linux) | Docker `node:20` |
| Mất lần nhấn phím ngắn hơn 1 tick | Người dùng chơi thử báo lỗi; tái hiện bằng phím thật |
| Làm quá phạm vi khi đổi giao diện; cầu theo ảnh mẫu có lan can trái bản đồ chuẩn | Người dùng xem; đối chiếu spec |
| Tự viết kỳ vọng test sai (44.9 chứ không phải 45; tick bình minh) | Test đỏ → đọc lại luật, không sửa code cho khớp test |
| Hiệu năng bench thấp (shader, quá nhiều draw call, pixel ratio) | `bench.json` với `slowest_ms`, thử tắt từng phần |
| Soak đạt trên Windows nhưng không đạt trên Linux | Docker; probe `process.memoryUsage()` chứng minh không rò rỉ |
| Ảnh/giao diện: màn hình Đổi phím tràn 720 px, chữ FPS 13 px | `scrollHeight`; script quét `getComputedStyle` |

## 5. Harness giúp nhiều nhất

1. **`scripts/verify.mjs` + scenario headless**: chạy đúng lệnh contract, 2 lần so tất định, ghi bảng bằng chứng; Phase 4 thêm so byte-by-byte với phase trước để chứng minh "không đổi luật".
2. **Docker Linux trong skill `verify-phase`**: bắt được 2 lỗi chỉ có trên Linux (Phase 1 esbuild, Phase 4 bộ nhớ soak) — đúng môi trường của giảng viên.
3. **`AGENTS.md`** giữ kiến trúc và thứ tự tick qua các phiên; hook Stop chặn kết thúc khi test đỏ; CI Ubuntu + macOS.

## 6. Token / chi phí AI (ước tính thủ công, không đo bằng công cụ)

| Phase | Đầu vào (phần lớn là cache ngữ cảnh) | Đầu ra |
|---|---|---|
| 1 | 1,5–2,5 triệu | 60–80 nghìn |
| 2 | 2–3 triệu | 90–120 nghìn |
| 3 | 1–1,5 triệu | 50–70 nghìn |
| 4 | 2–3 triệu | 80–110 nghìn |
| **Tổng** | **~6,5–10 triệu** | **~280–380 nghìn** |

Cách tiết kiệm đã dùng: tuning đọc thẳng từ contract (một nguồn số); test < 1 s cho vòng sửa ngắn; sửa file bằng script thay chuỗi có `assert` thay vì viết lại cả file; đo bench 10 s khi thử, 30 s một lần chính thức; việc chạy lâu (Docker) để ở nền. Tốn không cần thiết: thử điều khiển khung trình duyệt bị ẩn, nhiều vòng chỉnh hình ảnh theo ảnh mẫu.

## 7. Nếu làm lại

- Dựng **Playwright headless từ Phase 1** để chơi thử tự động và chụp ảnh bằng chứng, không phụ thuộc khung trình duyệt.
- Viết **benchmark và đo bộ nhớ sớm** (ít nhất từ Phase 2), chạy trên Linux trong CI, để không phải tối ưu dồn ở cuối.
- Cố định quy trình mỗi phase: đọc ticket → giả định → test + scenario → code → verify + Docker → commit + tag, **trước** khi nhận ticket mới.
- Thiết kế giao diện theo yêu cầu dễ tiếp cận ngay từ đầu (đổi phím, cỡ chữ theo biến CSS) thay vì sửa lại toàn bộ CSS ở Phase 4.
