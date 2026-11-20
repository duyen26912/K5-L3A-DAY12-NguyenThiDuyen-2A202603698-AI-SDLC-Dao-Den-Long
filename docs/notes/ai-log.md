# Nhật ký dùng AI

Công cụ: **Claude Code** (desktop app, model Claude Opus 5.5). Harness: `AGENTS.md` (+ `CLAUDE.md` trỏ tới), skill `.claude/skills/verify-phase`, hook Stop `.claude/settings.json` → `scripts/hooks/stop-check.mjs`.

## Phase 1

| Bước | Việc giao cho AI | AI sai gì / cách phát hiện | Xử lý |
|---|---|---|---|
| Đọc yêu cầu | Đọc 6 file lab + PRD-0 trên lab board (đọc qua ảnh chụp vì trang cần đăng nhập) | Dòng snapshot mẫu bị cắt ngang trong khung code → lần đầu thiếu trường `score` | Cuộn ngang khung code, đọc đủ dòng mẫu |
| Kiến trúc | Tách `core` (luật) / `render` (Three.js) / `headless.ts`; tuning đọc thẳng từ `game.contract.json` | — | Ghi vào AGENTS.md để các phase sau giữ |
| Core + headless | Viết luật Đêm 1 + IO theo contract | 1) Bóng Mực trong scenario được đặt id `S3` thay vì `S1` (bộ đếm id không reset khi scenario thay danh sách) — phát hiện khi chạy ví dụ contract và đọc output. 2) Bóng Mực choáng 179 tick thay vì 180 và hồi chiêu ngắn hơn 1 tick (đếm lùi ngay trong bước vừa kích hoạt) — phát hiện nhờ test `choáng hết pulse_stun_s` | Sửa cách đặt id + test; sửa thứ tự đếm lùi |
| Test | 22 test core + 5 test CLI thật | Hai test tự viết đọc nhầm snapshot tick 0 (quên `snapshotEvery: 1`) — test đỏ, không phải lỗi game | Sửa test, ghi chú |
| Linux | Chạy trong Docker `node:20` | Test CLI gọi `node node_modules/esbuild/bin/esbuild` — trên Windows đó là file JS nhưng trên Linux là binary → 5 test đỏ chỉ trên Linux | Đổi sang esbuild JS API (`buildSync`). Bài học: luôn chạy thử trên Linux trước khi tag |
| Bằng chứng | Bot chơi trên core để sinh file inputs thắng trọn đêm; script `verify` sinh bảng kết quả | — | — |
| Giao diện | Three.js scene, HUD, âm thanh WebAudio | Không chơi tay được trọn đêm vì khung trình duyệt của công cụ bị ẩn (requestAnimationFrame dừng) | Ghi "đạt một phần" trong bằng chứng, cần chơi tay trước khi quay video |
| Chơi thử (người dùng) | Người dùng báo "không di chuyển để nhặt đom đóm được" | Tái hiện bằng phím thật: input chỉ đọc phím **đang giữ** tại mỗi tick 1/60 s → lần nhấn nhanh hơn 1 tick (kể cả E/Q/Space) bị mất. Test core không bắt được vì lỗi nằm ở lớp nhập phím của giao diện | Thêm bộ nhớ "đã nhấn kể từ tick trước"; theo yêu cầu người dùng đổi điều khiển: mũi tên ↑↓←→ để đi (WASD vẫn dùng được), giữ chuột kéo để xoay camera; chặn cuộn trang khi bấm mũi tên. Kiểm tra lại bằng phím thật trong trình duyệt |
| Giao diện đèn (người dùng) | Thay mô hình Đèn Lồng Lớn theo ảnh tham khảo, chỉ đổi hình ảnh | Lần đầu AI làm quá phạm vi: đổi luôn cả phong cách toàn cảnh (bloom, cây, sương) → người dùng yêu cầu hoàn tác | Hoàn tác, làm lại đúng phạm vi: chỉ `src/render/lantern.ts` + chỗ gọi trong `main.ts`. Ánh đèn 3 mức: chưa nạp tắt, nạp dở sáng nhẹ, đủ sáng mạnh + vùng sáng bán kính `safe_radius`. Output headless không đổi |

### Token / chi phí (ước tính)
- Phiên Claude Code Phase 1 (gồm cả đọc tài liệu, CP0, viết code, test, Docker, tài liệu): ước tính **khoảng 1,5–2,5 triệu token đầu vào (phần lớn là cache đọc lại ngữ cảnh) và khoảng 60–80 nghìn token đầu ra**. Đây là ước tính thủ công, không đo bằng công cụ; số chính xác xem trang usage của tài khoản.
- Cách tiết kiệm đã dùng: tuning đọc thẳng từ contract (không phải đồng bộ hai nơi); một hàm `simulate()` dùng chung cho test và headless; test chạy trong < 1 giây nên vòng sửa–kiểm ngắn; đọc lab board bằng ảnh thu nhỏ/zoom vùng thay vì nhiều ảnh to.
- Tốn token không cần thiết: thử cuộn trang lab board nhiều lần trước khi tìm ra cách phóng to khung nhìn; thử điều khiển game trong trình duyệt khi khung bị ẩn.
