import { asyncHandler } from '../utils/asyncHandler.js';
import { getDatabaseReadiness } from '../services/readiness.service.js';
import { softLaunchMetrics } from '../services/softLaunchMetrics.service.js';

function warningsFor(stats, database) {
  const warnings = [];
  if (!database.ok) {
    warnings.push({ code: 'DATABASE_DOWN', severity: 'critical',
      message: 'Không kết nối được PostgreSQL. Cần kiểm tra database và logs VPS.' });
  }
  const total = stats.total;
  if (total.requests >= 25 && total.serverErrors >= 3 && total.errorRatePct >= 2) {
    warnings.push({ code: 'HTTP_5XX_SPIKE', severity: 'critical',
      message: 'Tỷ lệ lỗi server 5xx cao trong 15 phút gần nhất.' });
  }
  if (total.sampledRequests >= 25 && total.p95Ms > 1500) {
    warnings.push({ code: 'SLOW_API', severity: 'warning',
      message: 'Độ trễ P95 của API vượt 1,5 giây.' });
  }
  if (total.rateLimited >= 10) {
    warnings.push({ code: 'RATE_LIMIT_SPIKE', severity: 'warning',
      message: 'Có nhiều request bị giới hạn tốc độ (HTTP 429).' });
  }
  return warnings;
}

export const publicReady = asyncHandler(async (_req, res) => {
  const database = await getDatabaseReadiness();
  res.set('Cache-Control', 'no-store');
  res.status(database.ok ? 200 : 503).json({
    ok: database.ok,
    service: 'hola-maps-api',
    database: database.database
  });
});

export const adminOperationsOverview = asyncHandler(async (_req, res) => {
  const database = await getDatabaseReadiness();
  const metrics = softLaunchMetrics.snapshot();
  const warnings = warningsFor(metrics, database);
  res.set('Cache-Control', 'private, no-store');
  res.json({
    checkedAt: new Date().toISOString(),
    status: warnings.some((item) => item.severity === 'critical')
      ? 'DEGRADED' : warnings.length ? 'ATTENTION' : 'HEALTHY',
    database,
    uptimeSeconds: Math.round(process.uptime()),
    heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
    metrics,
    warnings,
    limitations: [
      'Số liệu tạm thời của tiến trình API này; sẽ đặt lại khi restart PM2.',
      'Chỉ thống kê nhóm API, không lưu IP, URL chi tiết, token hoặc nội dung request.',
      'Trạng thái sao lưu ngoài VPS và độ trễ điện thoại thực tế cần kiểm tra riêng.'
    ]
  });
});
