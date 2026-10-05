import { AppError } from '../utils/AppError.js';

export const CONTRIBUTION_MAX_POINTS = 20;

export const CONTRIBUTION_SCORE_CRITERIA = [
  {
    key: 'placeValue',
    label: 'Giá trị địa điểm / dữ liệu',
    max: 4,
    description: 'Mức độ hữu ích, độc đáo hoặc cần thiết của địa điểm/thông tin với cộng đồng.'
  },
  {
    key: 'accuracy',
    label: 'Chính xác & xác thực',
    max: 5,
    description: 'Tên, vị trí, địa chỉ và thông tin có thể đối chiếu, đáng tin cậy.'
  },
  {
    key: 'freshness',
    label: 'Độ mới của thông tin / ảnh',
    max: 4,
    description: 'Thông tin và hình ảnh phản ánh tình trạng gần đây của địa điểm.'
  },
  {
    key: 'visualCoverage',
    label: 'Ảnh & mức độ thể hiện không gian',
    max: 4,
    description: 'Ảnh rõ ràng, có giá trị nhận diện và thể hiện được không gian/thực tế địa điểm.'
  },
  {
    key: 'completeness',
    label: 'Độ đầy đủ thông tin',
    max: 3,
    description: 'Có đủ các trường cần thiết như mô tả, địa chỉ, giờ mở cửa, mức giá, liên hệ khi phù hợp.'
  }
];

function toInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : NaN;
}

export function evaluateContributionScore(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('Cần chấm điểm chất lượng trước khi duyệt đóng góp.', 400);
  }

  const breakdown = {};
  for (const criterion of CONTRIBUTION_SCORE_CRITERIA) {
    const value = toInteger(input[criterion.key]);
    if (!Number.isFinite(value) || value < 0 || value > criterion.max) {
      throw new AppError(
        `${criterion.label} phải nằm trong khoảng 0-${criterion.max} điểm.`,
        400
      );
    }
    breakdown[criterion.key] = value;
  }

  const total = CONTRIBUTION_SCORE_CRITERIA.reduce(
    (sum, criterion) => sum + breakdown[criterion.key],
    0
  );

  if (total < 0 || total > CONTRIBUTION_MAX_POINTS) {
    throw new AppError(`Điểm đóng góp không được vượt quá ${CONTRIBUTION_MAX_POINTS}.`, 400);
  }

  return {
    total,
    maxPoints: CONTRIBUTION_MAX_POINTS,
    breakdown
  };
}

export function getContributionScoringPolicy() {
  return {
    maxPoints: CONTRIBUTION_MAX_POINTS,
    criteria: CONTRIBUTION_SCORE_CRITERIA
  };
}
