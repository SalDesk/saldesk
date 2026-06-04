import api from './api';

/**
 * Upload a single image to the server.
 * @param {File} file - Image file to upload
 * @param {(pct: number) => void} onProgress - Progress callback (0-100)
 * @returns {{ url: string, thumbnail_url: string }}
 */
export async function uploadImage(file, onProgress) {
  const formData = new FormData();
  formData.append('image', file);

  const { data } = await api.post('/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });

  return data.data; // { url, thumbnail_url }
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE_MB    = 5;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export function validateImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `Formato invalido: ${file.name}. Usa JPG, PNG ou WebP.`;
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `Ficheiro demasiado grande: ${file.name}. Maximo ${MAX_IMAGE_SIZE_MB}MB.`;
  }
  return null;
}
