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
| Giao diện đèn lần 2 (người dùng) | Đổi Đèn Lồng Lớn sang dáng cột đèn theo ảnh tham khảo mới, giữ nguyên chức năng | — | Chỉ thay `src/render/lantern.ts` (cùng API `update(frac, lit)`), thanh tiến độ đặt theo chiều cao mới. 3 mức sáng giữ nguyên; output headless không đổi |
| Bụi cỏ (người dùng) | Thay bụi cây hình cầu tối bằng bụi cỏ lá nhỏ / vừa / to theo ảnh tham khảo | — | `src/render/bushes.ts`: chùm lá xếp lớp (InstancedMesh, xanh đậm dưới → xanh vàng trên), cỏ ở gốc, hoa vàng nhỏ. Chỉ hiển thị, output headless không đổi |
| Bụi cây lần 2 (người dùng) | Đổi bụi cỏ lá sang dáng bụi cây hoạt hình theo ảnh mẫu mới | — | `src/render/bushes.ts`: tán gồm 12 khối tròn mềm (ngọn sáng hơn), lá nhỏ thò ra, thân nâu phân nhánh, lá phẳng quanh gốc; giữ 3 cỡ nhỏ/vừa/to. Chỉ hiển thị, output headless không đổi |

### Token / chi phí (ước tính)
- Phiên Claude Code Phase 1 (gồm cả đọc tài liệu, CP0, viết code, test, Docker, tài liệu): ước tính **khoảng 1,5–2,5 triệu token đầu vào (phần lớn là cache đọc lại ngữ cảnh) và khoảng 60–80 nghìn token đầu ra**. Đây là ước tính thủ công, không đo bằng công cụ; số chính xác xem trang usage của tài khoản.
- Cách tiết kiệm đã dùng: tuning đọc thẳng từ contract (không phải đồng bộ hai nơi); một hàm `simulate()` dùng chung cho test và headless; test chạy trong < 1 giây nên vòng sửa–kiểm ngắn; đọc lab board bằng ảnh thu nhỏ/zoom vùng thay vì nhiều ảnh to.
- Tốn token không cần thiết: thử cuộn trang lab board nhiều lần trước khi tìm ra cách phóng to khung nhìn; thử điều khiển game trong trình duyệt khi khung bị ẩn.

## Phase 2

| Bước | Việc giao cho AI | AI sai gì / cách phát hiện | Xử lý |
|---|---|---|---|
| Đọc yêu cầu | Đọc Ticket-02 | Lab board không đọc được trong khung trình duyệt của công cụ (tab Phase 2 khóa khi chưa đăng nhập) | Người làm bài dán nội dung ticket vào chat |
| Kế hoạch | Ưu tiên logic + headless (test ẩn 30 điểm) → test/scenario → giao diện | — | Ghi vào spec `docs/notes/spec-phase-2.md` |
| Core | Viết lại `world.ts` theo 12 bước tick, `maps.ts` cho 3 Đêm, IO v1.1 | 1) Gió Lạc biến mất sớm 1 tick (đếm lùi ngay trong tick kích hoạt) — test `Tỏa Sáng trúng lúc flee` bắt được. 2) Lúc đầu viết nhầm một dòng giữ chỗ (`p.vy_set()`) không tồn tại — typecheck bắt được | Chuyển đếm lùi flee sang bước 2 (bộ đếm); viết lại đoạn đó |
| Test | 25 test Đêm 1 (số chuẩn) + 23 test Phase 2 + 5 test CLI | 2 test tự viết sai kỳ vọng: số `sim_tick` sau khi resume (tick resume cũng chạy mô phỏng), và scenario `charms: []` xóa mất bùa mặc định | Sửa test theo đúng luật, ghi chú trong test |
| Bot | Bot chơi để có bằng chứng thắng | Bot cũ thua hết với số chuẩn (Bóng Mực nhiều, nhanh) | Thêm né, lướt, tỏa sáng; thắng Đêm 1 (seed 5). Đêm 2–3 chưa thắng — ghi trung thực |
| Giao diện | Menu, chuỗi 3 Đêm, pause, cài đặt, HUD, bản đồ, Gió Lạc, Bùa, âm thanh, bảng màu | Nhấn Enter ở màn giới thiệu bấm lại nút "Đêm 2" đang được focus → nạp lại Đêm thay vì bắt đầu — phát hiện khi chạy thử bằng phím thật | `blur()` nút sau khi bấm + chặn mặc định Enter |
| Linux | Docker `node:20` | — | 53/53 test, 18/18 scenario, sha256 trùng Windows |
| Cảnh vật (người dùng) | Thêm cây thông, hoa anh đào, đảo núi tuyết; thay cầu Đêm 2 theo ảnh cầu gỗ có lan can | Ảnh mẫu có **lan can và mặt cầu cong**, trái với bản đồ chuẩn ("không lan can", mặt cầu Y = 0) | Giữ phong cách (gỗ, bệ đá, trụ đèn) nhưng bỏ lan can, mặt cầu phẳng để hình khớp luật rơi; đảo núi đặt lúc đầu quá xa bị sương che → kéo lại gần. Chỉ hiển thị, output headless không đổi |
| Mô hình nhân vật (người dùng) | Thêm cây cau (Đêm 2); làm lại mô hình Mây, đom đóm, Bóng Mực, Gió Lạc, Bùa Gió, bục nhảy, giữ màu chuẩn | 1) Thiếu khai báo tham số `cam` trong `update()` → cảnh trống; typecheck bắt được. 2) Cây cau che camera vì cây không có va chạm — phát hiện qua ảnh chụp | Sửa chữ ký hàm; ẩn tạm cây nằm trên đường nhìn camera → Mây. Chỉ hiển thị, output headless không đổi |
| Lửa + pháp sư (người dùng) | Đom đóm thành ngọn lửa, lóe sáng khi nhặt; Mây thành pháp sư theo ảnh; lửa trong Đèn Lồng Lớn khi sáng | Ảnh pháp sư áo xanh trái với màu chuẩn áo Mây `#E8E2D0` / khăn `#C8102E`. Kính đèn lúc đầu đục nên không thấy lửa bên trong. Lóe sáng khó chụp vì khung trình duyệt ẩn chỉ vẽ khi chụp ảnh | Giữ dáng pháp sư nhưng áo ngà + khăn đỏ (mũ xanh vì không thuộc màu chuẩn); kính đèn trong suốt hơn; kiểm tra lóe sáng bằng biến debug `__fx()` + ảnh. Chỉ hiển thị, output headless không đổi |
| Nón lá + bảng điều khiển (người dùng) | Đổi mũ thành nón lá, xóa đảo núi, phóng to ngọn lửa, làm đẹp bảng phím | Phím mũi tên bị xuống dòng rồi đè chữ — phát hiện qua ảnh chụp | Nới cột phím; bảng dạng ô phím (`kbd`), H để ẩn/hiện. Chỉ hiển thị, output headless không đổi |
| Đuốc + Bóng Mực + bảng phím (người dùng) | Bảng điều khiển chỉ để ký hiệu; Bóng Mực sáng hơn; đuốc bị nón lá che | Đầu gậy nằm trong vành nón (bán kính 0.78 m) — lỗi đặt vị trí khi đổi mũ sang nón lá | Gậy dài hơn, nghiêng ra ngoài, lửa ở cao 2.4 m ngoài vành nón; Bóng Mực giữ thân `#120A1A`, sáng nhờ phát quang/viền/quầng tím `#7A3CFF`. Chỉ hiển thị, output headless không đổi |
| Cây (người dùng) | Không ẩn cây khi đi ngang qua | Người chơi thấy cây biến mất là lạ | Bỏ cơ chế ẩn cây; cây vẫn không có va chạm (đi xuyên qua được) |

### Token / chi phí Phase 2 (ước tính)
- Ước tính **khoảng 2–3 triệu token đầu vào (phần lớn là cache ngữ cảnh) và khoảng 90–120 nghìn token đầu ra**. Ước tính thủ công, không đo bằng công cụ.
- Tiết kiệm: logic trước, giao diện sau; một hàm `simulate()` dùng cho cả test và CLI; test chạy < 1 s; scenario file ngắn dùng chung một `p2-empty.scenario.json`.
- Tốn thêm: nhiều lần chụp ảnh nhỏ để "đẩy" khung hình khi khung trình duyệt bị ẩn; thử đọc lab board trước khi biết phải đăng nhập.
