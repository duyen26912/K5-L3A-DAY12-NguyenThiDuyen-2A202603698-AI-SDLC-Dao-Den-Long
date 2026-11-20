# Kết quả kiểm chứng headless (phase-3)

Sinh tự động bởi `npm run verify -- phase-3` lúc 2026-11-20T14:43:54.029Z. Không sửa tay.

- Lệnh: `node dist-headless/headless.mjs <tham số> --out <file>` (đúng `headless_cmd` trong game.contract.json, contract 1.2)
- Máy: Windows_NT 10.0.19045 (x64), Node v26.13.0, CPU: AMD Ryzen 5 5600H with Radeon Graphics         
- Mỗi scenario chạy 2 lần và so sánh byte-by-byte để kiểm tra tính tất định.

| Scenario | Yêu cầu kiểm chứng | Mong đợi | Kết quả thực tế | Tất định | Thời gian | Đạt |
|---|---|---|---|---|---:|---|
| [p1-contract-example](p1-contract-example.jsonl) | Regression: ví dụ Test Contract (Đêm 1) vẫn chạy đúng định dạng với số chuẩn | 1 mote_picked; không pulse (chỉ mang 1 < 3) | end: state=playing, ticks=300, score=0 | giống hệt | 142 ms | ĐẠT |
| [p1-light-last-lantern](p1-light-last-lantern.jsonl) | Regression (sửa theo Ticket-03): nạp đủ 10 → lantern_lit; thắp đèn cuối KHÔNG còn thắng sớm | deposit 10, lantern_lit, chưa game_over | end: state=playing, ticks=600, score=150 | giống hệt | 125 ms | ĐẠT |
| [p1-dawn](p1-dawn.jsonl) | Regression: hết giờ → lost/dawn | game_over lost/dawn tại tick 120 | end: state=lost, ticks=120, score=0 | giống hệt | 127 ms | ĐẠT |
| [p2-dash](p2-dash.jsonl) | Lướt 14 m/s × 0.2 s, hồi chiêu 1.5 s (lần nhấn tick 30 bị bỏ qua) | dash tại tick 1 và 91; x = 2.8 m sau 12 tick | end: state=playing, ticks=120, score=0 | giống hệt | 159 ms | ĐẠT |
| [p2-pause](p2-pause.jsonl) | Tạm dừng: tick tăng, sim_tick/thời gian đứng yên, state paused | paused tick 60, resumed tick 180; sim_tick đứng ở 59 | end: state=playing, ticks=240, score=0 | giống hệt | 152 ms | ĐẠT |
| [p2-fall](p2-fall.jsonl) | Rơi khỏi đảo: −1 Ngọn Lửa, mất hết đom đóm, chờ 60 tick, hồi sinh bất tử | player_hit by fall, lost 7; hồi sinh (0,0,0) sau 60 tick | end: state=playing, ticks=200, score=0 | giống hệt | 130 ms | ĐẠT |
| [p2-n2-bridge](p2-n2-bridge.jsonl) | Đêm 2: đi qua cầu tre từ đảo A sang đảo B | x > 60 (đảo B), không rơi | end: state=playing, ticks=600, score=0 | giống hệt | 120 ms | ĐẠT |
| [p2-n2-pad](p2-n2-pad.jsonl) | Đêm 2: bục nhảy bắn sang đảo B (14 m/s lên, 24 m/s ngang), đáp trong đảo B | đáp xuống trong đảo B, không rơi | end: state=playing, ticks=150, score=0 | giống hệt | 105 ms | ĐẠT |
| [p2-n3-ramp](p2-n3-ramp.jsonl) | Đêm 3: đi lên dốc 30° từ Y=0 lên tầng 1 (Y=3) | player Y = 3 | end: state=playing, ticks=100, score=0 | giống hệt | 146 ms | ĐẠT |
| [p2-n3-pad](p2-n3-pad.jsonl) | Đêm 3: bục nhảy (0,3,13) → đáp tầng 2 (Y=6) | player Y = 6, grounded | end: state=playing, ticks=120, score=0 | giống hệt | 108 ms | ĐẠT |
| [p2-n3-wind](p2-n3-wind.jsonl) | Đêm 3: gió mạnh tại 30 s, 5 s, đẩy 2 m/s | wind.active true ở tick 1800, false ở 2100 | end: state=playing, ticks=2160, score=0 | giống hệt | 132 ms | ĐẠT |
| [p2-drifter-steal](p2-drifter-steal.jsonl) | Gió Lạc: đuổi khi mang ≥ 5, cướp 3, flee 240 tick rồi removed | drifter_steal amount 3; removed sau 240 tick | end: state=playing, ticks=400, score=0 | giống hệt | 107 ms | ĐẠT |
| [p2-drifter-drop](p2-drifter-drop.jsonl) | Gió Lạc: Tỏa Sáng trúng lúc flee có mang → thả lại 3 đom đóm | drifter_drop amount 3; 3 đom đóm rơi | end: state=playing, ticks=130, score=0 | giống hệt | 100 ms | ĐẠT |
| [p2-charm](p2-charm.jsonl) | Bùa Gió: nhặt → 600 tick, 7.2 m/s, lướt không hồi chiêu | charm_picked 600; 2 lần dash cách 15 tick; đi 7.2 m trong 60 tick | end: state=playing, ticks=120, score=0 | giống hệt | 100 ms | ĐẠT |
| [p2-safe-evict](p2-safe-evict.jsonl) | Vùng an toàn: Bóng Mực trong vùng khi đèn vừa thắp bị đẩy ra ≤ 30 tick, không gây sát thương | lantern_lit, không player_hit, bóng ở mép 6 m sau 30 tick | end: state=playing, ticks=40, score=150 | giống hệt | 109 ms | ĐẠT |
| [p2-n2-random-full](p2-n2-random-full.jsonl) | Đêm 2 ngẫu nhiên chạy hết (spawn Bóng Mực, Gió Lạc), tất định, ≤ 30 s | 8 shade_spawned (tối đa Đêm 2) | end: state=lost, ticks=16200, score=0 | giống hệt | 362 ms | ĐẠT |
| [p2-n3-random-full](p2-n3-random-full.jsonl) | Đêm 3 ngẫu nhiên chạy hết, tất định, ≤ 30 s | 10 shade_spawned (tối đa Đêm 3) | end: state=lost, ticks=14578, score=0 | giống hệt | 435 ms | ĐẠT |
| [p3-fuel-out](p3-fuel-out.jsonl) | Dầu hao 1/giây; hết dầu → lantern_out, đèn tắt, deposited 0, nhớ ever_lit | lantern_out L1 tại tick 60, fuel 0, ever_lit true | end: state=playing, ticks=90, score=0 | giống hệt | 96 ms | ĐẠT |
| [p3-refuel](p3-refuel.jsonl) | Châm dầu: used = min(mang, ceil((100−fuel)/10)), fuel tối đa 100, +5/đom đóm | refuel amount 6 → fuel 100, điểm 30 | end: state=playing, ticks=5, score=30 | giống hệt | 115 ms | ĐẠT |
| [p3-relight](p3-relight.jsonl) | Thắp lại đèn đã từng sáng: chỉ cần 5, +40, relight: true, relit_count 1 | deposit 5, lantern_lit relight, điểm 25 + 40 | end: state=playing, ticks=5, score=65 | giống hệt | 98 ms | ĐẠT |
| [p3-drain](p3-drain.jsonl) | Bóng Mực wander tới đèn fuel < 30, drain 5/giây cộng dồn, fuel_drain mỗi 60 tick, đèn tắt thì bỏ drain | 2 Bóng Mực drain, ≥ 2 fuel_drain, L1 tắt | end: state=playing, ticks=400, score=0 | giống hệt | 111 ms | ĐẠT |
| [p3-drain-pulse](p3-drain-pulse.jsonl) | Tỏa Sáng trúng Bóng Mực đang drain → stunned, +15 | stunned, điểm 15 | end: state=playing, ticks=5, score=15 | giống hệt | 115 ms | ĐẠT |
| [p3-no-early-win](p3-no-early-win.jsonl) | Thắp đủ 5/5 đèn không kết thúc Đêm | lantern_lit, không game_over | end: state=playing, ticks=120, score=150 | giống hệt | 123 ms | ĐẠT |
| [p3-dawn-win](p3-dawn-win.jsonl) | Bình minh: còn sống + 3/5 đèn sáng → won/dawn_survived, thưởng 50+floor(fuel)/đèn + 50/Ngọn Lửa | won/dawn_survived, điểm 594 | end: state=won, ticks=120, score=594 | giống hệt | 109 ms | ĐẠT |
| [p3-dawn-lose](p3-dawn-lose.jsonl) | Bình minh mà chỉ 2/5 đèn sáng → lost/dawn | lost/dawn | end: state=lost, ticks=120, score=0 | giống hệt | 106 ms | ĐẠT |
| [p3-capacity](p3-capacity.jsonl) | Sức chứa = 10 + 2 × successful_lights (1 lần thắp → 12) | capacity 12, mang 12 | end: state=playing, ticks=2, score=0 | giống hệt | 113 ms | ĐẠT |

Tổng: 26/26 đạt.
