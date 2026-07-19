import { useState, useCallback } from 'react';
import { convertToWebPWithPreview } from '@/lib/webpConverter';

interface ImagePreviewState {
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  compressedFile: File | null;
  isProcessing: boolean;
  error: string | null;
}

const initialState: ImagePreviewState = {
  originalSize: 0,
  compressedSize: 0,
  savedPercent: 0,
  compressedFile: null,
  isProcessing: false,
  error: null,
};

export function useImagePreview() {
  const [preview, setPreview] = useState<ImagePreviewState>(initialState);

  const processImage = useCallback(async (file: File | Blob) => {
    setPreview((prev) => ({ ...prev, isProcessing: true, error: null }));
    try {
      const result = await convertToWebPWithPreview(file);
      setPreview({
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        savedPercent: result.savedPercent,
        compressedFile: result.file,
        isProcessing: false,
        error: null,
      });
      return result.file;
    } catch (err) {
      setPreview((prev) => ({
        ...prev,
        isProcessing: false,
        error: (err as Error).message,
      }));
      throw err;
    }
  }, []);

  const reset = useCallback(() => setPreview(initialState), []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return {
    ...preview,
    processImage,
    reset,
    formatSize,
    originalSizeFormatted: formatSize(preview.originalSize),
    compressedSizeFormatted: formatSize(preview.compressedSize),
  };
}
