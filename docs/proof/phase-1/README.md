# Bằng chứng Phase 1 (PRD-0 + Test Contract v1.0)

Tái lập toàn bộ ở tag `phase-1`:

```bash
npm ci && npm run build
```

```bash
npm test && npm run verify -- phase-1
```

| File | Nội dung |
|---|---|
| [headless-verify.md](headless-verify.md) | Kết quả 7 scenario headless (sinh tự động, mỗi cái chạy 2 lần so tất định) |
| `*.jsonl` | Output headless thật của từng scenario |
| [linux-docker.log](linux-docker.log) | Build + 27 test + 7 scenario chạy trên Linux (Docker `node:20`), sha256 output trùng Windows |
| [screenshot-seed2026-start.jpg](screenshot-seed2026-start.jpg) | Game có giao diện chạy trong trình duyệt: đảo, Mây, đèn, đom đóm, HUD, la bàn |

## Truy vết yêu cầu → bằng chứng

| Yêu cầu (PRD-0 / Contract) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` ở gốc, tuning đúng số game dùng | Game import trực tiếp file này; test kiểm đủ trường | `src/core/config.ts`, test `contract: tuning…` | Đạt |
| Lệnh headless + tham số, thoát 0, dòng cuối `end` | Test CLI thật + verify | `tests/headless.test.ts`, [contract-example.jsonl](contract-example.jsonl) | Đạt |
| File sai định dạng → mã 2; lỗi → stderr | Test CLI (scenario thiếu tọa độ, JSON hỏng, tick không tăng, move > 1) | `tests/headless.test.ts` | Đạt |
| Snapshot tick 0 + mỗi `--snapshot-every`; `time_left_s` | Test `output: snapshot…` | `tests/core.test.ts` | Đạt |
| Tất định | Chạy 2 lần so byte; so sha256 Windows vs Linux | [headless-verify.md](headless-verify.md), [linux-docker.log](linux-docker.log) | Đạt |
| Đi lại theo hướng camera, chuẩn hóa vector | 3 test di chuyển (yaw 0, yaw 90°, [1,1]) | `tests/core.test.ts` | Đạt |
| Nhảy | Test nhảy lên rồi tiếp đất | `tests/core.test.ts` | Đạt |
| Đom đóm rải rác, nhặt được, giới hạn sức chứa | Test nhặt + ngoài bán kính | `tests/core.test.ts` | Đạt |
| Nạp ánh sáng vào đèn để thắp | Test deposit/lantern_lit, nạp từng phần, ngoài bán kính, giữ nút chỉ nạp 1 lần | `tests/core.test.ts`, [light-last-lantern.jsonl](light-last-lantern.jsonl) | Đạt |
| Bóng Mực xuất hiện và đuổi | Test đuổi đúng tốc độ, `shade_spawned` theo thời gian | `tests/core.test.ts`, [random-idle-seed42.jsonl](random-idle-seed42.jsonl) | Đạt |
| Bị chạm mất máu, rơi đom đóm, bất tử | Test + scenario | [hit-and-lose.jsonl](hit-and-lose.jsonl) | Đạt |
| Tỏa sáng xua Bóng Mực, tốn ánh sáng, hồi chiêu | Test + scenario | [pulse-save.jsonl](pulse-save.jsonl) | Đạt |
| Bóng Mực sợ đèn | Test không vào `safe_radius` của đèn đã thắp trong 10 s | `tests/core.test.ts` | Đạt |
| Thắng (thắp hết đèn), thua (hết máu / hết giờ), điểm | Test + 3 scenario | [light-last-lantern.jsonl](light-last-lantern.jsonl), [hit-and-lose.jsonl](hit-and-lose.jsonl), [dawn.jsonl](dawn.jsonl) | Đạt |
| Chơi được Đêm 1 từ đầu tới thắng | Bot chơi trên core với seed 2026 → file inputs → headless phát lại | [bot-win-seed2026.jsonl](bot-win-seed2026.jsonl) (5 đèn, thắng tick 2706) | Đạt |
| Game 3D, camera thứ ba, HUD, chơi lại | Chạy trong trình duyệt, chụp màn hình; điều khiển W đi đúng +Z | [screenshot-seed2026-start.jpg](screenshot-seed2026-start.jpg) | Đạt một phần (xem dưới) |
| Chạy trên macOS/Linux | Docker Linux; CI ubuntu + macos | [linux-docker.log](linux-docker.log), `.github/workflows/ci.yml` | Đạt (Linux); macOS chờ CI chạy sau khi push |

## Chưa kiểm chứng đầy đủ (ghi trung thực)
- **Chơi tay toàn bộ một đêm trên giao diện**: đã kiểm tra trang tải không lỗi, HUD/đèn/đom đóm hiển thị, phím W di chuyển đúng hướng. Nhưng trong lúc làm, khung trình duyệt của công cụ bị ẩn nên vòng lặp vẽ bị tạm dừng, chưa chơi tay trọn một đêm trên giao diện. Luật chơi dùng chung `src/core` với headless nên đã được test đầy đủ ở trên. Cần chơi thử tay trước khi quay video.
- **macOS**: chưa có máy macOS; CI có job `macos-latest`, sẽ chạy khi push.
