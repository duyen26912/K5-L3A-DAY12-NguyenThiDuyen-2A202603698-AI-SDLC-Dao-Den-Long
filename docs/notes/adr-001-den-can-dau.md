# ADR-001: Mô hình trạng thái đèn có nhiên liệu và luật thắng "giữ đảo sáng tới bình minh"

- **Trạng thái:** Đã chấp nhận (Phase 3, Ticket-03, Contract v1.2)
- **Thay thế:** luật "đèn đã sáng không nhận thêm đom đóm", "Bóng Mực không bao giờ vào vùng an toàn", "thắng ngay khi tất cả đèn sáng" (Ticket-02)

## Bối cảnh
Playtest: người chơi giỏi thắp hết đèn trong 2 phút rồi game kết thúc, thiếu căng thẳng cuối Đêm. Ticket-03 yêu cầu đèn có thể tắt lại và đổi mục tiêu sang giữ đủ đèn sáng tới bình minh.

## Quyết định

### 1. Mô hình trạng thái đèn
Trước (Phase 2): `unlit → (nạp đủ 10) → lit` — một chiều, `lit` là trạng thái cuối.

Sau (Phase 3): vòng trạng thái có nhiên liệu:

```
           nạp đủ cost (10 lần đầu, 5 nếu ever_lit)
  unlit ─────────────────────────────────────────▶ lit (fuel = 100)
    ▲                                               │  │
    │        fuel ≤ 0 (ngay sau bước 2 của tick)    │  │ châm dầu: fuel = min(100, fuel + 10·used)
    └───────────────── lantern_out ◀────────────────┘  │
                       deposited = 0, ever_lit giữ ◀───┘
```

- Trường mới của `Lantern`: `fuelU` (dầu theo **đơn vị nguyên 1/60**, 0…6000), `everLit`, `relitCount`.
- **Vì sao dùng đơn vị nguyên 1/60:** hao 1/giây = 1 đơn vị/tick, hút 5/giây = 5 đơn vị/tick, mỗi đom đóm = 600 đơn vị. Không có số thực tích lũy → output tất định và giống nhau giữa các máy (ticket cũng khuyến nghị). Chỉ làm tròn 1 chữ số thập phân khi xuất snapshot/sự kiện.
- **Vùng an toàn là thuộc tính suy ra**, không lưu: `hasSafeZone(l) = l.lit && fuelU ≥ 30·60`. Nhờ vậy cùng một bước "vùng an toàn" (bước 6) xử lý cả hai trường hợp ticket nêu: đèn vừa thắp và đèn vừa được châm lên ≥ 30 đều đẩy Bóng Mực trong vùng ra mép trong ≤ 30 tick, không gây sát thương.
- Chọn đèn khi tương tác: tập "đèn nhận được" = chưa sáng **hoặc** sáng nhưng `fuel < 100`; gần nhất, bằng nhau id nhỏ hơn. Đèn sáng → châm dầu (`refuel`), đèn tắt → nạp để thắp (`deposit` + `lantern_lit {relight}`).

### 2. Bóng Mực có trạng thái `drain`
`wander → drain` khi tới cách đèn sáng có `fuel < 30` ≤ 2 m. Thoát `drain`: Mây trong 6 m → `chase`; trúng Tỏa Sáng → `stunned` (+15 điểm); đèn tắt / `fuel ≥ 30` / cách > 2 m → `wander`. Lượng hút được trừ ở **bước 2** cùng với hao tự nhiên (đúng thứ tự ticket), `fuel_drain` ghi mỗi 60 tick hút của từng con.

### 3. Luật thắng
Bỏ kiểm tra "tất cả đèn sáng" trong bước thắng/thua. Bước 11 giờ là:
1. `flames ≤ 0` → thua `no_flames` (luôn trước, kể cả tick bình minh);
2. hết giờ → đếm đèn đang sáng: `≥ ceil(0.6 × tổng)` → thắng `dawn_survived` (+50 + floor(fuel) mỗi đèn sáng, +50 mỗi Ngọn Lửa), ngược lại thua `dawn`.

### 4. Sức chứa
Không lưu riêng; suy ra `capacity = min(20, 10 + 2 × successfulLights)`, `successfulLights` tăng mỗi lần thắp thành công (kể cả thắp lại), đèn đặt sẵn bằng scenario không tính.

## Hệ quả
- Đơn giản: thêm 3 trường cho đèn, 2 cho Bóng Mực (`targetLanternId`, `drainTicks`), 1 cho người chơi; phần còn lại là hàm suy ra.
- Test Phase 1–2 dựa trên luật bị thay đã được **sửa theo luật mới kèm ghi chú `Phase 3:`** (thời lượng, điểm, thắng sớm, contract) — không skip. Danh sách ở `CHANGELOG.md` (breaking changes).
- Bot tự chơi cũ (thắng bằng cách thắp hết đèn) không còn thắng; bot mới chưa thắng được với luật dầu + 6 Bóng Mực hút → ghi trong bằng chứng là chưa đạt.
- Rủi ro: wander của Bóng Mực giờ nhắm vào đèn (yếu hoặc tắt) nên chúng tụ quanh đèn — đúng ý ticket (tạo áp lực cuối Đêm) nhưng có thể làm game khó; cân bằng để phase sau.
