# Kết quả kiểm chứng headless (phase-1)

Sinh tự động bởi `npm run verify` lúc 2026-11-20T08:18:02.162Z. Không sửa tay.

- Lệnh: `node dist-headless/headless.mjs --night 1 <tham số> --out <file>` (đúng `headless_cmd` trong game.contract.json)
- Máy: Windows_NT 10.0.19045 (x64), Node v26.13.0, CPU: AMD Ryzen 5 5600H with Radeon Graphics         
- Mỗi scenario chạy 2 lần và so sánh byte-by-byte để kiểm tra tính tất định.

| Scenario | Yêu cầu kiểm chứng | Mong đợi | Kết quả thực tế | Tất định | Thời gian | Đạt |
|---|---|---|---|---|---:|---|
| [contract-example](contract-example.jsonl) | Ví dụ scenario + inputs trong Test Contract v1.0 (C, D): nhặt đom đóm, interact, pulse | 1 mote_picked, 1 pulse, dòng cuối end | end: state=playing, ticks=300, score=30 | giống hệt | 54 ms | ĐẠT |
| [light-last-lantern](light-last-lantern.jsonl) | Nạp đèn → lantern_lit; thắp hết 5 đèn → thắng (won/all_lit), cộng điểm | lantern_lit L1, game_over won/all_lit | end: state=won, ticks=31, score=369 | giống hệt | 38 ms | ĐẠT |
| [hit-and-lose](hit-and-lose.jsonl) | Bóng Mực đuổi và chạm → mất máu, rơi đom đóm; hết máu → thua (lost/no_flames) | 2 lần player_hit (lần 1 rơi 2 đom đóm), game_over lost/no_flames | end: state=lost, ticks=197, score=0 | giống hệt | 53 ms | ĐẠT |
| [pulse-save](pulse-save.jsonl) | Tỏa sáng xua Bóng Mực gần (choáng + đẩy lùi), Bóng Mực xa không bị ảnh hưởng | pulse stunned_ids ["S1"], không bị chạm trong 2 giây | end: state=playing, ticks=120, score=20 | giống hệt | 52 ms | ĐẠT |
| [dawn](dawn.jsonl) | Hết thời gian đêm → thua (lost/dawn); time_left_s giảm đúng 1/60 mỗi tick | game_over lost/dawn tại tick 120 | end: state=lost, ticks=120, score=0 | giống hệt | 54 ms | ĐẠT |
| [bot-win-seed2026](bot-win-seed2026.jsonl) | Chơi trọn Đêm 1 với đom đóm/Bóng Mực ngẫu nhiên theo seed, từ đầu tới thắng | 5 lantern_lit, thắng | end: state=won, ticks=2706, score=1214 | giống hệt | 49 ms | ĐẠT |
| [random-idle-seed42](random-idle-seed42.jsonl) | Chạy ngẫu nhiên theo seed, người chơi đứng yên: Bóng Mực đuổi tới, mất máu, thua | thua (no_flames) | end: state=lost, ticks=767, score=0 | giống hệt | 41 ms | ĐẠT |

Tổng: 7/7 đạt.
