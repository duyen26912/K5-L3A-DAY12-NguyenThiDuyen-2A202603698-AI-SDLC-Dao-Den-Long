# Changelog

## phase-2 — Ticket-02 "Ba hòn đảo", Test Contract v1.1
- Số liệu chuẩn thay số tự chọn; thứ tự xử lý tick 12 bước; điểm chuẩn hóa.
- 3 Đêm: Đảo Bến (chuẩn hóa), Đảo Cau (2 đảo, cầu tre, bục nhảy), Đảo Chuông (3 tầng, dốc, bục, tháp chuông, gió mạnh).
- Lướt, Tạm dừng, Rơi khỏi đảo, Gió Lạc, Bùa Gió; trạng thái Bóng Mực spawning/wander/chase/recoil/stunned.
- Giao diện: menu → giới thiệu → chơi → kết quả → Đêm kế, Bình Minh; menu tạm dừng; cài đặt lưu localStorage; nhạc nền + hiệu ứng; HUD đầy đủ; bảng màu chuẩn; bộ đếm FPS (F3).
- 53 test, 18 scenario headless (`npm run verify -- phase-2`).

## phase-1 — PRD-0, Test Contract v1.0
- Màn Đêm 1 – Đảo Bến: đảo tròn 5 Đèn Lồng Lớn, đom đóm, Bóng Mực, tỏa sáng, thắng/thua, điểm, HUD, chơi lại.
- Chế độ headless theo Test Contract v1.0 (`game.contract.json`, JSONL snapshot/event/end, tất định theo seed).
- Test đơn vị + scenario headless, script kiểm chứng, CI (Ubuntu + macOS), hook Stop chặn khi test đỏ.
