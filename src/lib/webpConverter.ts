import imageCompression from 'browser-image-compression';

/**
 * Converts any image File/Blob to WebP format with compression.
 * Uses browser-image-compression (already installed) internally.
 */
export async function convertToWebP(
  file: File | Blob,
  maxSizeMB = 1,
  maxDimension = 1920
): Promise<File> {
  const options = {
    maxSizeMB,
    maxWidthOrHeight: maxDimension,
    useWebWorker: true,
    fileType: 'image/webp' as const,
  };

  const compressed = await imageCompression(file as File, options);
  return new File([compressed], `image-${Date.now()}.webp`, { type: 'image/webp' });
}
