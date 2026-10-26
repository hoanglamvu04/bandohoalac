import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AppError } from '../utils/AppError.js';

const MAX_DELIVERY_EDGE = 2000;
const ENCODE_TIMEOUT_MS = 60_000;

function resizeArgs(file) {
  const width = Number(file?.detectedWidth);
  const height = Number(file?.detectedHeight);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new AppError('Không thể xác định kích thước ảnh tải lên.', 400);
  }

  if (width <= MAX_DELIVERY_EDGE && height <= MAX_DELIVERY_EDGE) return [];
  return width >= height
    ? ['-resize', String(MAX_DELIVERY_EDGE), '0']
    : ['-resize', '0', String(MAX_DELIVERY_EDGE)];
}

function runEncoder(inputPath, outputPath, resizeOptions) {
  return new Promise((resolve, reject) => {
    const args = [
      '-quiet', '-metadata', 'none', '-q', '84', '-m', '4',
      ...resizeOptions, inputPath, '-o', outputPath
    ];
    const child = spawn('cwebp', args, {
      stdio: 'ignore',
      windowsHide: true
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, ENCODE_TIMEOUT_MS);

    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (timedOut) reject(new Error('Image encoding timed out.'));
      else if (code === 0) resolve();
      else reject(new Error('Image decoder rejected the uploaded file.'));
    });
  });
}

// Re-encode before remote upload: a transformed delivery URL does not prevent
// access to the original image (and its EXIF) stored by the image provider.
export async function sanitizeUploadedImage(file) {
  const dimensions = resizeArgs(file);
  if (!file?.path && !Buffer.isBuffer(file?.buffer)) {
    throw new AppError('Không tìm thấy dữ liệu ảnh tải lên.', 400);
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'hola-image-'));
  const outputPath = path.join(tempDir, 'clean.webp');

  try {
    let inputPath = file.path;
    if (!inputPath) {
      inputPath = path.join(tempDir, 'input-image');
      await writeFile(inputPath, file.buffer, { mode: 0o600 });
    }

    await runEncoder(inputPath, outputPath, dimensions);
    const clean = await readFile(outputPath);
    if (
      clean.length < 16 ||
      clean.toString('ascii', 0, 4) !== 'RIFF' ||
      clean.toString('ascii', 8, 12) !== 'WEBP'
    ) {
      throw new Error('Image encoder produced an invalid WebP file.');
    }
    return clean;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new AppError('Máy chủ chưa có bộ xử lý ảnh an toàn (cwebp).', 503);
    }
    if (error instanceof AppError) throw error;
    throw new AppError('Ảnh không hợp lệ hoặc không thể xử lý an toàn.', 400);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
