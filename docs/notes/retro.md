# Đánh giá từng phase & retro

## Phase 1 — đánh giá nhanh

**Đạt:** toàn bộ phạm vi PRD-0 (Đêm 1 – Đảo Bến, 5 đèn, đom đóm, Bóng Mực, tỏa sáng, thắng/thua, điểm, HUD, chơi lại) và Test Contract v1.0. 27/27 test, 7/7 scenario headless đạt trên Windows và Linux, output trùng từng byte giữa hai hệ điều hành.

**Đạt một phần:** chưa chơi tay trọn một đêm trên giao diện (xem `docs/proof/phase-1/README.md`); macOS chỉ kiểm qua CI sau khi push.

**AI sai ở đâu:** lỗi đếm id khi scenario thay danh sách; lỗi lệch 1 tick ở thời gian choáng/hồi chiêu; test CLI phụ thuộc cách esbuild cài trên Windows. Cả ba được bắt bởi chạy thật (đọc output, test, Docker), không phải bởi "agent bảo chạy rồi".

**Chỉnh harness:**
- `AGENTS.md`: thêm quy tắc "chỉ dùng lệnh chạy được trên macOS/Linux", "không Math.random trong core", thứ tự một bước mô phỏng.
- Skill `verify-phase`: gom quy trình kiểm chứng + Docker Linux thành một chỗ.
- Hook Stop: chặn kết thúc khi typecheck/test đỏ (đã thử bằng một test cố ý đỏ → hook thoát mã 2).
- CI GitHub Actions trên Ubuntu + macOS.

**Rủi ro cho phase sau:** contract có thể đổi (ví dụ thêm `--night 2`, dash, rơi khỏi đảo). Logic tách ở `src/core`, mỗi luật có test riêng nên dễ sửa; phải chạy lại toàn bộ scenario cũ.

## Phase 2 — đánh giá nhanh

**Đạt:** số chuẩn + thứ tự tick, bản đồ 3 Đêm, Lướt, Tạm dừng, Rơi, Gió Lạc, Bùa Gió, gió mạnh, contract v1.1 (snapshot/scenario/input/sự kiện). 53/53 test, 18/18 scenario headless, giống hệt giữa Windows và Linux. Regression Đêm 1 chạy lại với số chuẩn.

**Có hỏng phase trước không:** luật Phase 1 bị Ticket-02 thay (điểm khi nạp thay vì khi nhặt, đèn cần 10, Bóng Mực sinh theo lịch…). Test Phase 1 đã sửa theo luật mới kèm lý do (assumptions.md Phase 2), không test nào bị tắt.

**Chưa đạt / chưa kiểm:** FPS ≥ 30 ở 1280×720 chưa đo trên máy thật; âm thanh và cài đặt chưa kiểm bằng tai/mắt; bot chưa thắng Đêm 2–3; màn kết quả/Bình Minh chưa chơi tay tới cuối.

**Chỉnh harness:** AGENTS.md thêm thứ tự 12 bước tick, tên trạng thái v1.1, vị trí số chuẩn/bản đồ, quy tắc ≥ 1 scenario/tính năng, quy ước commit. Skill verify-phase thêm bước đo FPS. Script verify nhận `--night` cho từng case.

## Phase 3 — đánh giá nhanh

**Đạt:** luật dầu đèn (hao, tắt, châm, thắp lại), vùng an toàn theo dầu, Bóng Mực `drain`, luật thắng bình minh + ngưỡng 60%, sức chứa tăng dần, bảng điểm mới, contract v1.2, chế độ mù màu, thanh dầu / nhấp nháy / đèn tắt xẹp + rách. 66/66 test, 26/26 scenario headless (gồm regression Phase 1–2), tất định.

**Có hỏng phase trước không:** các luật bị Ticket-03 thay (thời lượng, điểm, thắng sớm, an toàn tuyệt đối) đã sửa test kèm ghi chú; các tính năng Phase 2 không bị thay (lướt, pause, rơi, Gió Lạc, Bùa, bản đồ) vẫn đạt nguyên test và scenario.

**Chưa đạt / chưa kiểm:** bot chưa thắng được một Đêm với luật mới; chưa chơi tay một Đêm trọn vẹn để cảm nhận độ khó; chế độ mù màu chỉ kiểm qua mã + ảnh, chưa nhờ người mù màu thử.

**Bài học:** chốt (commit + tag) phase trước khi nhận ticket mới — Phase 3 suýt phải làm chồng lên Phase 2 chưa commit. Luật thay đổi lớn nên viết ADR trước khi code: nhờ coi vùng an toàn là thuộc tính suy ra (`fuel ≥ 30`) mà một bước xử lý dùng chung cho "vừa thắp" và "vừa châm dầu".
