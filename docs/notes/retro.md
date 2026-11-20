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
