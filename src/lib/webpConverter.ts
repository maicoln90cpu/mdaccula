import imageCompression from 'browser-image-compression';

const MAX_FILE_SIZE_MB = 5;

/**
 * Converts any image File/Blob to WebP format with compression.
 * Throws if the original file exceeds 5MB (pre-upload validation).
 * Returns the compressed file and savings info.
 */
export async function convertToWebP(
  file: File | Blob,
  maxSizeMB = 1,
  maxDimension = 1920
): Promise<File> {
  // Pre-upload size validation
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(
      `Imagem muito grande: ${sizeMB.toFixed(1)}MB. O limite é ${MAX_FILE_SIZE_MB}MB. Reduza a imagem antes de enviar.`
    );
  }

  const options = {
    maxSizeMB,
    maxWidthOrHeight: maxDimension,
    useWebWorker: true,
    fileType: 'image/webp' as const,
  };

  const compressed = await imageCompression(file as File, options);
  return new File([compressed], `image-${Date.now()}.webp`, { type: 'image/webp' });
}

/**
 * Converts and returns savings metadata for preview UI.
 */
export async function convertToWebPWithPreview(
  file: File | Blob,
  maxSizeMB = 1,
  maxDimension = 1920
): Promise<{ file: File; originalSize: number; compressedSize: number; savedPercent: number }> {
  const originalSize = file.size;
  const compressed = await convertToWebP(file, maxSizeMB, maxDimension);
  const compressedSize = compressed.size;
  const savedPercent = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;

  return { file: compressed, originalSize, compressedSize, savedPercent };
}

/**
 * Converts the original file into both a "full" and a "thumb" WebP variant.
 * Both are encoded independently from the original source (not from each
 * other) to avoid compounding lossy re-encode artifacts.
 */
export async function convertToWebPWithThumb(
  file: File | Blob,
  fullOpts: { maxSizeMB?: number; maxDimension?: number } = {},
  thumbOpts: { maxSizeMB?: number; maxDimension?: number } = {}
): Promise<{ full: File; thumb: File }> {
  const [full, thumb] = await Promise.all([
    convertToWebP(file, fullOpts.maxSizeMB ?? 1, fullOpts.maxDimension ?? 1920),
    convertToWebP(file, thumbOpts.maxSizeMB ?? 0.08, thumbOpts.maxDimension ?? 400),
  ]);
  return { full, thumb };
}
