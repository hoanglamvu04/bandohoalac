# QUY TẮC BÀN GIAO BẮT BUỘC CHO CHATGPT / AI CODING AGENTS

Tài liệu này dành cho bất kỳ ChatGPT, Codex hoặc lập trình viên nào tiếp tục phát triển [HOLA Maps](https://github.com/hoanglamvu04/bandohoalac). **Không coi nội dung chat cũ là nguồn xác nhận hiện trạng** nếu chưa đối chiếu Git, mã nguồn và CI.

## 1. Quy trình bắt buộc TRƯỚC KHI CODE

1. Đọc `AGENTS.md`, toàn bộ mục đầu của `LUU_Y_CODE/README.md`, báo cáo, kế hoạch và nhật ký mới nhất.
2. Kiểm tra `git status`, SHA `main`, nhánh hiện tại, PR mở liên quan, CI gần nhất, migration/test trong repository.
3. Chọn **ID nhiệm vụ** từ kế hoạch; nếu việc mới, tạo ID `HOLA-P0-xxx` / `HOLA-P1-xxx` / `HOLA-P2-xxx` và nêu phụ thuộc/nghiệm thu.
4. Ghi rõ **đã có gì** và **còn thiếu gì**; không code lại tính năng đã merge nếu chỉ chưa deploy hoặc cần kiểm thử.
5. Tạo nhánh/PR gọn, tránh đẩy trực tiếp lên `main` khi chưa qua CI. Không tự chạy migration/seed trên production.

## 2. Trong khi code

- Đọc và giữ nguyên các hợp đồng API, mô hình PostGIS PG16, RBAC/2FA, moderation, consent và quyền riêng tư.
- Tất cả bài đăng BĐS từ người dùng phải **chờ duyệt** trước khi xuất hiện công khai; không chuyển quyền duyệt cho người đăng.
- Không đưa PII, GPS cá nhân, nội dung biểu mẫu, session/token vào tracking hoặc X-HUB; WA-005 tuân theo phê duyệt riêng.
- Không phá CMS/CRM/login/chức năng đang hoạt động, và không tự đổi Nginx/PM2/VPS.
- Bổ sung test cho trường hợp thành công, lỗi, quyền, dữ liệu thiếu/trùng/quá hạn; nêu rõ khi chưa thể chạy.
- Không lưu secrets, file `.env`, dump/ảnh người dùng hoặc bằng chứng nhạy cảm trong Git.

## 3. Bắt buộc cập nhật trong CÙNG PR sửa code

- **BAO_CAO_TIEN_DO.md:** ngày, ID, ghi đúng trạng thái hiện tại, phạm vi/CI/bằng chứng (đang PR thì ghi đang PR).
- **KE_HOACH_TIEP_THEO.md:** tiến độ task và việc tiếp; nếu không đổi thứ tự, ghi đã kiểm tra và giữ nguyên.
- **NHAT_KY_CODE.md:** thêm một mục mới gồm file/code, PR, tests, blocker, công việc bàn giao.
- Cập nhật `QUY_TAC_CHATGPT.md` / `README.md` nếu quy trình hoặc cấu trúc thay đổi.
- Nhắc lại các thay đổi này trong phần checkbox của Pull Request. CI kiểm tra sự hiện diện cập nhật ba file cho PR sửa code (trừ Dependabot).

## 4. Sau CI, review, merge và triển khai

1. Nếu CI FAIL: sửa, ghi rõ bài test lỗi, chạy lại; **không tuyên bố PASS khi chưa có kết quả**.
2. Nếu CI PASS nhưng PR còn mở: ghi `ĐANG LÀM / CHỜ MERGE` và link PR.
3. Sau merge: xác minh SHA `main` và cập nhật lại hồ sơ ở một commit/PR tài liệu kế tiếp để sửa trạng thái từ `ĐANG LÀM` thành `ĐÃ MERGE — CHƯA XÁC MINH DEPLOY`.
4. Sau deploy: kiểm tra URL, API, migration, RBAC, PM2/Nginx, ảnh thực tế và theo dõi lỗi. Không gọi là `ĐÃ NGHIỆM THU` nếu chỉ reload PM2.
5. Những phần phụ thuộc chủ dự án/VPS/X-HUB giữ `BỊ CHẶN` và nêu chính xác người hoặc bằng chứng cần có.
6. Trước khi kết thúc lượt, soát lại kế hoạch, không bỏ trống bước tiếp theo.

## 5. Mẫu báo cáo khi chuyển cho ChatGPT khác

> Tôi đang tiếp tục repository `hoanglamvu04/bandohoalac`. Đọc `AGENTS.md` và toàn bộ thư mục `LUU_Y_CODE/` trước tiên. Xác minh `main`, PR mở, CI, các migration và mã thực tế. Chọn một ID trong `KE_HOACH_TIEP_THEO.md`, triển khai có kiểm thử, không tự deploy production. Trong cùng PR sửa code, bắt buộc cập nhật `BAO_CAO_TIEN_DO.md`, `KE_HOACH_TIEP_THEO.md`, `NHAT_KY_CODE.md`. Kết thúc hãy báo rõ đã code, CI, PR/merge, chưa làm, blocker và bước tiếp. Không tự nhận toàn bộ Sprint xong khi chưa có bằng chứng.

## 6. Nguồn xác nhận theo thứ tự ưu tiên

1. **Git/CI hiện tại:** `main`, PR merge, review, workflow thành công/thất bại.
2. **Mã nguồn, test và migration thực tế**, hợp đồng API.
3. **Bằng chứng production**, log không nhạy cảm, checklist nghiệm thu và người chịu trách nhiệm.
4. **Sổ `LUU_Y_CODE/`**, cập nhật thủ công theo các mục trên.
5. Nội dung trò chuyện cũ hoặc nhận định — chỉ là gợi ý, không chứng minh đã triển khai.

**Một ví dụ phân biệt:** “Đã merge API vào main” không có nghĩa “API đang chạy trên maps.dothihoalac.vn”; “đã dùng PostGIS” không tự chứng minh số liệu giá có đủ mẫu; “PR #92 tồn tại” không có nghĩa đã kết nối X-HUB production.
