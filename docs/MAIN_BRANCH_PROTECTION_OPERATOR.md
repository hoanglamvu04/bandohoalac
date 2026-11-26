# HOLA Maps — bảo vệ main (HOLA-OPS-118)

**Bằng chứng 26/11/2026:** GitHub branch `main` trả `protected=false`, chưa có ruleset. Đây là rủi ro quản trị; một Pull Request không tự bật được bảo vệ. Cần **GitHub repository administrator**.

1. Vào **Settings → Rules → Rulesets** hoặc **Settings → Branches → Branch protection rules**, tạo rule áp dụng đúng `main`.
2. Bắt buộc PR, cấm force-push và xóa branch. Hạn chế bypass; chỉ định cơ chế emergency có audit nếu cần.
3. Bắt buộc toàn bộ checks hiện hành: `LUU_Y_CODE handoff updated` (chỉ chạy cho PR không phải Dependabot), `Repository safety gate`, `Frontend build`, `Frontend E2E stability`, `Backend migrate and test`, `Production dependency audit`, `Shell security scripts`, các check CodeQL của workflow bảo mật. **Đối chiếu tên check chính xác trong Actions trước khi lưu**, và cân nhắc quy tắc riêng cho Dependabot vì job bàn giao bị skip.
4. Nếu dùng require branch up-to-date, xem xét queue merge và policy tránh nghẽn CI khi nhiều PR.
5. Kiểm tra bằng PR thử nghiệm và ảnh Ruleset `active`, branch `main` `protected=true`. Lưu bằng chứng không nhạy cảm vào `LUU_Y_CODE`.

**Trạng thái:** `CHO_QUAN_TRI_VIEN` — không thể tự xác nhận hoàn thành từ mã nguồn. Không chạy hoặc giả lập quy tắc bảo vệ branch bằng post-push CI.
