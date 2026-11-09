import * as React from 'react';
import { Camera, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { prepareImage, photoUrl, usePhotos } from '@/lib/photos';
import { Alert, Button } from './ui';
import { cn, initials, avatarColor } from '@/lib/utils';

// Choose a photo, preview it, then save it. Used on My Profile and on the
// "add your photo" screen that appears until a photo has been added.
export function PhotoUploader({ userId, name, onSaved, compact }: { userId: string; name: string; onSaved?: () => void; compact?: boolean }) {
  const { photos, reload } = usePhotos();
  const input = React.useRef<HTMLInputElement>(null);
  const [picked, setPicked] = React.useState<{ preview: string; base64: string } | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const current = photos[userId] ? photoUrl(userId, photos[userId]) : null;
  const shown = picked?.preview || current;

  const choose = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError('');
    try { setPicked(await prepareImage(f)); } catch (x: any) { setError(x.message); }
  };
  const save = async () => {
    if (!picked) return;
    setBusy(true); setError('');
    try {
      await api('/profile/photo', { method: 'PUT', body: { image: picked.base64 } });
      await reload(); setPicked(null); onSaved?.();
    } catch (x: any) { setError(x.message); } finally { setBusy(false); }
  };

  return (
    <div className={cn('flex gap-5', compact ? 'items-center' : 'flex-col items-center text-center')}>
      <div className={cn('relative shrink-0 overflow-hidden rounded-full ring-4 ring-white shadow-card', compact ? 'size-20' : 'size-32')}>
        {shown
          ? <img src={shown} alt="" className="size-full object-cover" />
          : <span className={cn('flex size-full items-center justify-center font-semibold text-white', avatarColor(name), compact ? 'text-xl' : 'text-3xl')}>{initials(name)}</span>}
      </div>
      <div className={cn('space-y-3', compact ? 'flex-1' : 'w-full')}>
        {error && <Alert tone="red">{error}</Alert>}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={choose} aria-label="Choose a profile photo" />
        <div className={cn('flex flex-wrap gap-2', !compact && 'justify-center')}>
          <Button type="button" variant="secondary" icon={<Camera className="size-4" />} onClick={() => input.current?.click()}>
            {shown ? 'Choose a different photo' : 'Choose photo'}
          </Button>
          {picked && <Button type="button" loading={busy} icon={<Upload className="size-4" />} onClick={save}>Save photo</Button>}
        </div>
        <p className="text-xs text-slate-500">JPEG, PNG or WebP. A clear, front-facing photo of your face. It is cropped to a square automatically.</p>
      </div>
    </div>
  );
}
