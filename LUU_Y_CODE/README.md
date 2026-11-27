# LƯU Ý CODE — HOLA Maps

**Điểm đọc bắt buộc trước khi code, và điểm cập nhật bắt buộc sau mỗi công việc.**

Thư mục `LUU_Y_CODE/` là sổ bàn giao chung giữa chủ dự án, lập trình viên và những phiên ChatGPT/AI khác nhau. Tên đường dẫn dùng chữ không dấu, không khoảng trắng để chạy ổn định trên Git, Linux/VPS và script.

## Bắt đầu từ đâu?

1. Đọc `/AGENTS.md` và `LUU_Y_CODE/QUY_TAC_CHATGPT.md` để hiểu quy trình và nguyên tắc bảo mật.
2. Đọc `LUU_Y_CODE/BAO_CAO_TIEN_DO.md` để nắm tình trạng thực tế, phiên bản đã kiểm chứng và những việc đang chặn phát hành.
3. Đọc `LUU_Y_CODE/KE_HOACH_TIEP_THEO.md` để chọn **một ID nhiệm vụ**, điều kiện nghiệm thu và thứ tự ưu tiên.
4. Đọc mục mới nhất của `LUU_Y_CODE/NHAT_KY_CODE.md` để biết phiên trước làm gì, sửa file nào, kiểm thử ra sao.
5. **Đối chiếu lại GitHub, mã nguồn, migrations và CI** trước khi thay đổi. File này là sổ tay, không thay thế bằng chứng từ Git.

## Các file và trách nhiệm

| Tài liệu | Ghi gì? | Cập nhật khi nào? |
|---|---|---|
| [BÁO CÁO TIẾN ĐỘ](BAO_CAO_TIEN_DO.md) | Ảnh chụp hiện trạng, Sprint, PR, CI, môi trường, blocker và nghiệm thu | Sau **mọi thay đổi mã nguồn** và sau merge/deploy có bằng chứng |
| [KẾ HOẠCH TIẾP THEO](KE_HOACH_TIEP_THEO.md) | Backlog có ID, mức ưu tiên, tiêu chí hoàn thành, phụ thuộc và công việc tiếp | Sau **mọi thay đổi mã nguồn** (ít nhất xác nhận ưu tiên/bước kế tiếp còn đúng) |
| [NHẬT KÝ CODE](NHAT_KY_CODE.md) | Nhật ký nối tiếp theo thời gian, PR/commit, file sửa, tests, phần chưa làm | Sau **mọi công việc**; không xóa lịch sử |
| [QUY TẮC CHATGPT](QUY_TAC_CHATGPT.md) | Quy trình để phiên ChatGPT mới tiếp nhận, code, test, báo cáo, bàn giao | Khi quy trình/điều kiện thay đổi |

[Ma trận ROADMAP_72](ROADMAP_72.md) — đối chiếu 72 hạng mục với bằng chứng code, thiếu sót và điều kiện nghiệm thu; kiểm tra PR/CI trước khi cập nhật.

[Roadmap 7 đợt (36 hạng mục)](ROADMAP_7_WAVES.md) — đợt nâng cấp trước; đối chiếu tình trạng thực tế.

**Roadmap kỹ thuật tiếp theo:** [HOLA Core Intelligence V2 — 10 đợt / 60 hạng mục](ROADMAP_CORE_INTELLIGENCE_V2.md). Bắt đầu từ HOLA-P1-301.01, thực hiện theo thứ tự 1 → 2 → 3 → 10 → 4–9; P0 an toàn áp dụng xuyên suốt. Đọc roadmap này trước các việc nâng cấp backend/database/thuật toán, cập nhật ID con và bằng chứng trong mỗi PR.

## Định nghĩa trạng thái

- **CHƯA LÀM**: chưa triển khai, mới là ý tưởng/kế hoạch.
- **ĐANG LÀM**: có nhánh hoặc PR thực hiện, chưa qua đủ cổng kiểm thử.
- **CHỜ DUYỆT / BỊ CHẶN**: cần phê duyệt, dữ liệu, hạ tầng, quyền hoặc kiểm thử.
- **ĐÃ MERGE — CHƯA DEPLOY**: có mã đã vào `main`, **không có bằng chứng** đã chạy trên VPS.
- **ĐÃ DEPLOY — CHƯA NGHIỆM THU**: có bằng chứng deploy nhưng thiếu kiểm tra vận hành thực tế.
- **ĐÃ NGHIỆM THU**: có bằng chứng kiểm thử trên môi trường đích và người chịu trách nhiệm chấp thuận.

**CI PASS ≠ đã lên VPS ≠ đã nghiệm thu public.** Không được dùng chữ “full”, “xong toàn bộ”, “LIVE” khi bằng chứng không tương ứng.

## Quy tắc cập nhật và lịch sử

- Giữ **một nguồn thông tin tiến độ** tại đây; `docs/` vẫn chứa hợp đồng kỹ thuật, API và runbook chi tiết.
- Mọi PR sửa `backend/`, `frontend/`, `scripts/`, workflow hoặc package phải đồng thời thay đổi **BAO_CAO_TIEN_DO.md**, **KE_HOACH_TIEP_THEO.md**, **NHAT_KY_CODE.md**. CI kiểm tra ba file này trên PR không phải Dependabot.
- Mỗi lần cập nhật ghi **ngày giờ GMT+7**, **ID công việc**, **PR/commit**, **kết quả test có thật**, **blocker** và **bước tiếp theo**.
- Trước merge: ghi đúng **PR đang chờ CI/merge**. Sau merge: cập nhật lại trạng thái bằng PR/commit tài liệu tiếp theo, **không ghi đã merge từ trước khi merge**.
- Khi không có thay đổi kế hoạch, ghi “Kế hoạch giữ nguyên sau khi đối chiếu” kèm ngày trong file kế hoạch.
- Không đưa mật khẩu, token, dữ liệu khách hàng, số điện thoại, tọa độ GPS cá nhân, ảnh nhạy cảm hoặc bản sao DB vào thư mục này.

Tham chiếu kiến trúc: `README.md`, `docs/`, `docs/PUBLIC_LAUNCH_P0_RUNBOOK.md`, `docs/integrations/`. Tài liệu `docs/IMPLEMENTATION_PLAN.md` là kế hoạch MVP cũ, không phản ánh đủ Sprint hiện tại.
