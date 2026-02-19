import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from './button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Upload, X, Crop } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { Label } from './label';
import { cn } from '@/lib/utils';
interface ImageUploadWithCropProps {
  onImageSelect: (file: File) => void;
  currentImageUrl?: string;
  aspectRatio?: number;
  label?: string;
  cropMode?: 'required' | 'optional' | 'none';
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ImageUploadWithCrop = ({ 
  onImageSelect, 
  currentImageUrl, 
  aspectRatio = 16 / 9,
  label = "Imagem",
  cropMode = 'required'
}: ImageUploadWithCropProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);

  const onCropComplete = useCallback((_croppedArea: CropArea, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/webp'
    };
    const compressedFile = await imageCompression(file, options);
    return new File([compressedFile], `image-${Date.now()}.webp`, { type: 'image/webp' });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOriginalFile(file);
      
      // Se cropMode='none', usar imagem direto sem crop
      if (cropMode === 'none') {
        const compressedFile = await compressImage(file);
        const previewUrl = URL.createObjectURL(compressedFile);
        setPreviewUrl(previewUrl);
        onImageSelect(compressedFile);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setShowCropDialog(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: CropArea): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/webp', 0.95);
    });
  };

  const handleCropConfirm = async () => {
    if (!selectedImage || !croppedAreaPixels) return;

    try {
      const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);
      const finalFile = await compressImage(croppedBlob as File);
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(finalFile);
      setPreviewUrl(previewUrl);
      
      onImageSelect(finalFile);
      setShowCropDialog(false);
      setSelectedImage(null);
    } catch (error) {
      console.error('Error cropping image:', error);
    }
  };

  const handleUseWithoutCrop = async () => {
    if (!originalFile) return;

    try {
      const compressedFile = await compressImage(originalFile);
      const previewUrl = URL.createObjectURL(compressedFile);
      setPreviewUrl(previewUrl);
      
      onImageSelect(compressedFile);
      setShowCropDialog(false);
      setSelectedImage(null);
      setOriginalFile(null);
    } catch (error) {
      console.error('Error processing image:', error);
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    setSelectedImage(null);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {previewUrl ? (
        <div className={cn(
          "relative w-full rounded-lg overflow-hidden bg-muted flex items-center justify-center",
          cropMode === 'none' || cropMode === 'optional' ? "min-h-48" : "aspect-video"
        )}>
          <img 
            src={previewUrl} 
            alt="Preview" 
            className={cn(
              cropMode === 'none' || cropMode === 'optional' 
                ? "max-w-full max-h-[400px] object-contain" 
                : "w-full h-full object-cover"
            )}
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemoveImage}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
            <p className="mb-2 text-sm text-muted-foreground">
              <span className="font-semibold">Clique para fazer upload</span> ou arraste
            </p>
            <p className="text-xs text-muted-foreground">PNG, JPG, WEBP (MAX. 10MB)</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
          />
        </label>
      )}

      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crop className="w-5 h-5" />
              Recortar Imagem
            </DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-[400px] bg-muted">
            {selectedImage && (
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label>Zoom</Label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCropDialog(false)}>
              Cancelar
            </Button>
            {cropMode === 'optional' && (
              <Button variant="secondary" onClick={handleUseWithoutCrop}>
                Usar sem recortar
              </Button>
            )}
            <Button onClick={handleCropConfirm}>
              Confirmar Recorte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
