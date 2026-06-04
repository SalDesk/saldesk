import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, X, Star, ChevronUp, ChevronDown,
  AlertCircle, GripVertical, ImageOff,
} from 'lucide-react';
import { uploadImage, validateImageFile, ALLOWED_IMAGE_TYPES } from '../../services/uploadService';

const MAX_DEFAULT = 10;

/* ── uid helper ── */
let _uid = 0;
function uid() { return `img_${Date.now()}_${_uid++}`; }

/* ── ProgressBar ── */
function ProgressBar({ value }) {
  return (
    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30 rounded-b overflow-hidden">
      <div
        className="h-full bg-ocean-400 transition-all duration-200"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

/* ── PhotoCard ── */
function PhotoCard({
  photo, idx, total,
  onRemove, onMoveUp, onMoveDown,
  isDragOver, onDragStart, onDragOver, onDrop, onDragEnd,
}) {
  const isFirst  = idx === 0;
  const isLast   = idx === total - 1;
  const isUploading = photo.uploading;

  return (
    <div
      draggable={!isUploading}
      onDragStart={() => onDragStart(idx)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(idx); }}
      onDrop={(e)  => { e.preventDefault(); onDrop(idx); }}
      onDragEnd={onDragEnd}
      className={`relative group rounded-md overflow-hidden border-2 transition-all ${
        isDragOver
          ? 'border-ocean-500 scale-105 shadow-lg'
          : photo.error
          ? 'border-error'
          : 'border-n-200 hover:border-ocean-300'
      } ${isUploading ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing'}`}
      style={{ aspectRatio: '4/3' }}
    >
      {/* Image */}
      {photo.url ? (
        <img
          src={photo.url}
          alt=""
          className="w-full h-full object-cover"
          onError={e => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-full bg-n-100 flex items-center justify-center">
          <ImageOff size={24} strokeWidth={1.25} className="text-n-300" />
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

      {/* Primary badge */}
      {isFirst && !isUploading && (
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-sand-500 text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide">
          <Star size={9} strokeWidth={2.5} />
          Principal
        </div>
      )}

      {/* Drag handle */}
      {!isUploading && (
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/40 rounded p-0.5">
            <GripVertical size={14} strokeWidth={1.75} className="text-white" />
          </div>
        </div>
      )}

      {/* Error indicator */}
      {photo.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/60">
          <AlertCircle size={20} strokeWidth={1.75} className="text-white" />
        </div>
      )}

      {/* Upload progress bar */}
      {isUploading && <ProgressBar value={photo.progress} />}

      {/* Loading overlay */}
      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-ocean-900/40">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Bottom controls */}
      {!isUploading && (
        <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-1.5 pb-1.5 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={() => onMoveUp(idx)}
              disabled={isFirst}
              className="w-6 h-6 flex items-center justify-center rounded bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 transition-colors"
              title="Mover para cima"
            >
              <ChevronUp size={12} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => onMoveDown(idx)}
              disabled={isLast}
              className="w-6 h-6 flex items-center justify-center rounded bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 transition-colors"
              title="Mover para baixo"
            >
              <ChevronDown size={12} strokeWidth={2.5} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="w-6 h-6 flex items-center justify-center rounded bg-error/80 text-white hover:bg-error transition-colors"
            title="Remover foto"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Drop Zone ── */
function DropZone({ onFiles, accepting }) {
  const [hovering, setHovering] = useState(false);
  const inputRef = useRef(null);

  function onDragOver(e) { e.preventDefault(); setHovering(true); }
  function onDragLeave()  { setHovering(false); }
  function onDrop(e) {
    e.preventDefault();
    setHovering(false);
    const files = Array.from(e.dataTransfer.files).filter(f => ALLOWED_IMAGE_TYPES.includes(f.type));
    if (files.length) onFiles(files);
  }
  function onInputChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length) onFiles(files);
    e.target.value = '';
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-md cursor-pointer transition-colors select-none ${
        hovering || accepting
          ? 'border-ocean-500 bg-ocean-50'
          : 'border-n-300 hover:border-ocean-400 hover:bg-n-50'
      }`}
      style={{ aspectRatio: '4/3' }}
    >
      <Upload
        size={22}
        strokeWidth={1.5}
        className={hovering ? 'text-ocean-600' : 'text-n-400'}
      />
      <p className="text-xs font-body text-center leading-tight px-2" style={{ color: hovering ? '#0D5470' : '#6B7280' }}>
        Clica ou arrasta<br />uma foto
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}

/* ─────────────────── Main ImageUploader ─────────────────── */
/**
 * ImageUploader — drag & drop multi-image uploader.
 *
 * Props:
 *   value       string[]     — current image URLs
 *   onChange    fn           — called with new string[] on any change
 *   maxImages   number       — max images allowed (default 10)
 *   label       string       — section label
 *   hint        string       — hint text below label
 */
export default function ImageUploader({
  value = [],
  onChange,
  maxImages = MAX_DEFAULT,
  label = 'Fotos',
  hint,
}) {
  const [photos, setPhotos] = useState(() =>
    value.map(url => ({ id: uid(), url, uploading: false, progress: 100, error: '' })),
  );
  const [globalError, setGlobalError] = useState('');
  const dragFrom = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const accepting = dragOverIdx === -1;

  /* Sync value → photos when value changes externally (e.g. edit mode) */
  useEffect(() => {
    setPhotos(
      value.map(url => ({ id: uid(), url, uploading: false, progress: 100, error: '' })),
    );
  }, []); /* only on mount — internal state owns it after that */

  /* Derive external value from photos that have a final URL */
  function notifyChange(nextPhotos) {
    const urls = nextPhotos
      .filter(p => !p.uploading && !p.error && p.url && !p.url.startsWith('blob:'))
      .map(p => p.url);
    onChange?.(urls);
  }

  async function handleFiles(files) {
    setGlobalError('');
    const slots = maxImages - photos.length;
    if (slots <= 0) { setGlobalError(`Maximo de ${maxImages} fotos atingido.`); return; }

    const toProcess = files.slice(0, slots);
    const errors = [];

    const newItems = toProcess.map(file => {
      const err = validateImageFile(file);
      if (err) { errors.push(err); return null; }
      const previewUrl = URL.createObjectURL(file);
      return { id: uid(), url: previewUrl, uploading: true, progress: 0, error: '', _file: file };
    }).filter(Boolean);

    if (errors.length) setGlobalError(errors[0]);
    if (!newItems.length) return;

    const next = [...photos, ...newItems];
    setPhotos(next);

    /* Upload each file */
    for (const item of newItems) {
      try {
        const result = await uploadImage(item._file, (pct) => {
          setPhotos(prev => prev.map(p =>
            p.id === item.id ? { ...p, progress: pct } : p,
          ));
        });
        /* Replace blob URL with final URL */
        URL.revokeObjectURL(item.url);
        setPhotos(prev => {
          const updated = prev.map(p =>
            p.id === item.id
              ? { ...p, url: result.url, uploading: false, progress: 100 }
              : p,
          );
          notifyChange(updated);
          return updated;
        });
      } catch {
        URL.revokeObjectURL(item.url);
        setPhotos(prev => prev.map(p =>
          p.id === item.id
            ? { ...p, url: '', uploading: false, error: 'Erro no upload. Tenta novamente.' }
            : p,
        ));
      }
    }
  }

  function removePhoto(idx) {
    const next = photos.filter((_, i) => i !== idx);
    setPhotos(next);
    notifyChange(next);
  }

  function movePhoto(idx, dir) {
    const next = [...photos];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setPhotos(next);
    notifyChange(next);
  }

  /* Drag-to-reorder */
  function onDragStart(idx)  { dragFrom.current = idx; }
  function onDragOver(idx)   { setDragOverIdx(idx); }
  function onDragEnd()       { dragFrom.current = null; setDragOverIdx(null); }
  function onDrop(toIdx) {
    const fromIdx = dragFrom.current;
    if (fromIdx === null || fromIdx === toIdx) { onDragEnd(); return; }
    const next = [...photos];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setPhotos(next);
    notifyChange(next);
    onDragEnd();
  }

  const canAdd = photos.length < maxImages;

  return (
    <div>
      {/* Label */}
      <div className="mb-2">
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600">
          {label}
          <span className="ml-1.5 font-normal normal-case tracking-normal text-n-400">
            {photos.filter(p => !p.error).length}/{maxImages}
          </span>
        </p>
        {hint && <p className="text-xs font-body text-n-400 mt-0.5">{hint}</p>}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {photos.map((photo, idx) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            idx={idx}
            total={photos.length}
            onRemove={removePhoto}
            onMoveUp={(i) => movePhoto(i, -1)}
            onMoveDown={(i) => movePhoto(i, 1)}
            isDragOver={dragOverIdx === idx}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
          />
        ))}

        {/* Drop zone */}
        {canAdd && (
          <DropZone
            onFiles={handleFiles}
            accepting={accepting}
          />
        )}
      </div>

      {/* Hints */}
      <div className="flex items-center justify-between mt-2">
        <p className="text-[11px] font-body text-n-400">
          JPG, PNG, WebP · max 5MB · primeira foto = capa principal
        </p>
        {canAdd && (
          <p className="text-[11px] font-mono text-n-400">
            {maxImages - photos.length} vaga(s) restante(s)
          </p>
        )}
      </div>

      {/* Global error */}
      {globalError && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-red-50 border border-red-100 rounded-sm">
          <AlertCircle size={13} strokeWidth={1.75} className="text-error shrink-0" />
          <p className="text-xs font-body text-error">{globalError}</p>
        </div>
      )}
    </div>
  );
}
