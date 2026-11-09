// Which staff members have a profile photo (and its version), loaded once per session.
import * as React from 'react';
import { api } from './api';

interface Photos { photos: Record<string, number>; reload: () => Promise<void> }
const Ctx = React.createContext<Photos>({ photos: {}, reload: async () => {} });

export function PhotosProvider({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = React.useState<Record<string, number>>({});
  const reload = React.useCallback(async () => {
    try { setPhotos((await api<{ photos: Record<string, number> }>('/photos')).photos); } catch { /* keep initials */ }
  }, []);
  React.useEffect(() => { reload(); }, [reload]);
  const value = React.useMemo(() => ({ photos, reload }), [photos, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePhotos = () => React.useContext(Ctx);
export const photoUrl = (userId: string, version: number) => `/api/users/${encodeURIComponent(userId)}/photo?v=${version}`;

// Shrinks and centre-crops a chosen image to a 320 x 320 JPEG in the browser.
// Returns a data: URL (for the preview) and the base64 body (for the upload).
export async function prepareImage(file: File): Promise<{ preview: string; base64: string }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG or WebP photo.');
  if (file.size > 10 * 1024 * 1024) throw new Error('That file is larger than 10 MB. Choose a smaller photo.');
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { throw new Error('This file could not be read as a photo.'); }
  const size = 320;
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();
  const preview = canvas.toDataURL('image/jpeg', 0.86);
  return { preview, base64: preview.slice(preview.indexOf(',') + 1) };
}
