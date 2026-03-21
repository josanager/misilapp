import { useState, useEffect, useRef } from 'react';
import { X, FileVideo, FileIcon, ChevronLeft, ChevronRight, XOctagon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useChatStore } from '../../stores/chatStore';
import { VideoPlayer } from './VideoPlayer';

interface MediaUploadModalProps {
  files: File[];
  topicId: string;
  onClose: () => void;
}

export function MediaUploadModal({ files, topicId, onClose }: MediaUploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [fileList, setFileList] = useState<File[]>(files);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [captions, setCaptions] = useState<string[]>(files.map(() => ''));
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [, setSkippedCount] = useState(0);
  
  const isCancelledRef = useRef(false);
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);
  const skippedIndexesRef = useRef<Set<number>>(new Set());
  const currentUploadIndexRef = useRef<number>(-1);

  const { sendMessage } = useChatStore();

  const totalSize = fileList.reduce((acc, f) => acc + f.size, 0);
  const currentFile = fileList[previewIndex];

  // Prevent flicker by generating URLs only when fileList changes, not every re-render
  useEffect(() => {
    const urls = fileList.map(f => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [fileList]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const removeFile = (idx: number) => {
    const newList = fileList.filter((_, i) => i !== idx);
    const newCaptions = captions.filter((_, i) => i !== idx);
    if (newList.length === 0) { onClose(); return; }
    setFileList(newList);
    setCaptions(newCaptions);
    setPreviewIndex(Math.min(previewIndex, newList.length - 1));
  };

  const handleCancelSingle = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!uploading) {
      removeFile(idx);
      return;
    }
    
    skippedIndexesRef.current.add(idx);
    setSkippedCount(c => c + 1); // trigger re-render
    
    // If it's the currently uploading file, abort its XHR immediately
    if (idx === currentUploadIndexRef.current) {
      if (activeXhrRef.current) activeXhrRef.current.abort();
    }
  };

  const getFileType = (file: File): 'video' | 'image' | 'file' => {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('image/')) return 'image';
    return 'file';
  };



  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUploadAll = async (sendType: 'media' | 'file') => {
    // Total size check
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (totalSize > MAX_SIZE) {
      setErrorMsg(`El tamaño total (${(totalSize/1024/1024).toFixed(1)}MB) supera el límite de 50MB.`);
      return;
    }

    setErrorMsg(null);
    setUploading(true);
    setUploadedBytes(0);
    setOverallProgress(0);

    try {
      isCancelledRef.current = false;
      skippedIndexesRef.current.clear();
      setSkippedCount(0);
      
      const mediaGroupId = fileList.length > 1 ? crypto.randomUUID() : undefined;
      
      // Track progress for each file individually to calculate overall progress correctly
      const fileProgressMap = new Map<number, number>();
      
      const uploadPromises = fileList.map(async (file, i) => {
        if (isCancelledRef.current || skippedIndexesRef.current.has(i)) return;

        const fileType = sendType === 'file' ? 'file' as const : getFileType(file);
        
        try {
          // Wrapped upload to track internal progress
          const onProgress = (loaded: number) => {
            fileProgressMap.set(i, loaded);
            const totalUploaded = Array.from(fileProgressMap.values()).reduce((sum, val) => sum + val, 0);
            setUploadedBytes(totalUploaded);
            setOverallProgress(Math.round((totalUploaded / totalSize) * 100));
          };

          // Modify uploadSingleFile to accept onProgress callback
          await uploadWithMultipart(file, captions[i], i, fileType, onProgress, mediaGroupId);
          fileProgressMap.set(i, file.size); // Ensure it's marked as 100% done
        } catch (err) {
          if (err instanceof Error && err.message === 'Cancelled') return;
          throw err;
        }
      });

      await Promise.all(uploadPromises);
      onClose();
    } catch (err) {
      if (isCancelledRef.current) return;
      console.error('Upload failed:', err);
      setErrorMsg(`Error al subir a R2: ${err instanceof Error ? err.message : 'Error desconocido'}.`);
    } finally {
      setUploading(false);
    }
  };

  const uploadWithMultipart = async (
    file: File, 
    caption: string, 
    index: number,
    fileType: 'video' | 'image' | 'file', 
    onProgress: (loaded: number) => void,
    mediaGroupId?: string
  ): Promise<void> => {
    const ext = file.name.split('.').pop();
    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const workerUrl = import.meta.env.VITE_UPLOAD_WORKER_URL || 'http://localhost:8787';
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session ? `Bearer ${session.access_token}` : '';

    let uploadId: string | null = null;
    let key: string | null = null;

    try {
      // 1. Create multipart upload
      const createRes = await fetch(`${workerUrl}/upload/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({ filename, contentType: file.type }),
      });

      if (!createRes.ok) throw new Error(`Create upload failed: ${createRes.status}`);
      const createData = await createRes.json();
      uploadId = createData.uploadId;
      key = createData.key;

      if (!uploadId || !key) throw new Error('Missing uploadId or key from create response');

      if (isCancelledRef.current || skippedIndexesRef.current.has(index)) {
        throw new Error('Cancelled');
      }

      // 2. Upload parts
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
      const totalParts = Math.ceil(file.size / CHUNK_SIZE);
      const parts = [];
      let uploadedBytes = 0;

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (isCancelledRef.current || skippedIndexesRef.current.has(index)) {
          throw new Error('Cancelled');
        }

        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const partRes = await fetch(`${workerUrl}/upload/part?uploadId=${uploadId}&key=${key}&partNumber=${partNumber}`, {
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
          },
          body: chunk, // Send the Blob directly
        });

        if (!partRes.ok) throw new Error(`Upload part ${partNumber} failed: ${partRes.status}`);
        const partData = await partRes.json();

        parts.push({
          partNumber: partData.partNumber,
          etag: partData.etag,
        });

        uploadedBytes += chunk.size;
        onProgress(uploadedBytes);
      }

      if (isCancelledRef.current || skippedIndexesRef.current.has(index)) {
        throw new Error('Cancelled');
      }

      // 3. Complete multipart upload
      const completeRes = await fetch(`${workerUrl}/upload/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({ uploadId, key, parts }),
      });

      if (!completeRes.ok) throw new Error(`Complete upload failed: ${completeRes.status}`);
      const completeData = await completeRes.json();

      const publicUrl = completeData.url;
      console.log('✅ Uploaded to R2:', publicUrl);

      const messageContent = caption.trim() || file.name;
      await sendMessage(topicId, messageContent, fileType, publicUrl, file.name, file.size, mediaGroupId);

    } catch (err) {
      if (err instanceof Error && err.message === 'Cancelled') {
        // Abort multipart upload if it was started
        if (uploadId && key) {
          fetch(`${workerUrl}/upload/abort`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
            body: JSON.stringify({ uploadId, key }),
          }).catch(e => console.error('Failed to abort upload:', e));
        }
      }
      throw err;
    }
  };

  const isVideo = currentFile?.type.startsWith('video/');
  const isImage = currentFile?.type.startsWith('image/');
  const previewUrl = previewUrls[previewIndex] || '';

  const handleCancelUpload = () => {
    isCancelledRef.current = true;
    if (activeXhrRef.current) activeXhrRef.current.abort();
    setUploading(false);
    onClose();
  };

  return (
    <div className="media-upload-overlay" onClick={(e) => { if (e.target === e.currentTarget && !uploading) onClose(); }}>
      <div className="media-upload-modal">
        {/* Header */}
        <div className="media-upload-header">
          <h3>
            {fileList.length === 1
              ? (isVideo ? 'Enviar video' : isImage ? 'Enviar imagen' : 'Enviar archivo')
              : `Enviar ${fileList.length} archivos`}
          </h3>
          {!uploading && (
            <button className="btn-icon" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="error-message" style={{ margin: '16px 0', padding: '8px 12px', fontSize: 13, textAlign: 'left' }}>
            {errorMsg}
          </div>
        )}

        {/* Main preview area */}
        <div className="media-upload-preview" style={{ position: 'relative' }}>
          {isImage && <img src={previewUrl} alt="Vista previa" style={{ maxHeight: 340, maxWidth: '100%', borderRadius: 10, objectFit: 'contain' }} />}
          {isVideo && <VideoPlayer key={previewUrl} src={previewUrl} style={{ maxHeight: 340, maxWidth: '100%', borderRadius: 10, background: '#000' }} />}
          {!isImage && !isVideo && (
            <div className="file-preview-icon">
              <FileIcon size={56} />
              <div style={{ fontSize: 13 }}>{currentFile?.name}</div>
            </div>
          )}

          {/* Navigation arrows if multiple files */}
          {fileList.length > 1 && (
            <>
              {previewIndex > 0 && (
                <button className="preview-nav-btn prev" onClick={() => setPreviewIndex(i => i - 1)}>
                  <ChevronLeft size={20} />
                </button>
              )}
              {previewIndex < fileList.length - 1 && (
                <button className="preview-nav-btn next" onClick={() => setPreviewIndex(i => i + 1)}>
                  <ChevronRight size={20} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Thumbnail strip for multiple files */}
        {fileList.length > 1 && (
          <div className="media-thumbnail-strip">
            {fileList.map((f, idx) => {
              const thumbUrl = previewUrls[idx] || '';
              const isThumbVideo = f.type.startsWith('video/');
              const isThumbImage = f.type.startsWith('image/');
              return (
                  <div
                  key={idx}
                  className={`media-thumb ${idx === previewIndex ? 'active' : ''}`}
                  onClick={() => setPreviewIndex(idx)}
                >
                  {isThumbImage && <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, opacity: skippedIndexesRef.current.has(idx) ? 0.4 : 1 }} />}
                  {isThumbVideo && (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', borderRadius: 6, opacity: skippedIndexesRef.current.has(idx) ? 0.4 : 1 }}>
                      <FileVideo size={22} color="#FF3737" />
                    </div>
                  )}
                  {!isThumbImage && !isThumbVideo && (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', borderRadius: 6, opacity: skippedIndexesRef.current.has(idx) ? 0.4 : 1 }}>
                      <FileIcon size={22} color="#CC2222" />
                    </div>
                  )}
                  
                  {skippedIndexesRef.current.has(idx) && (
                    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <XOctagon color="#ef4444" size={20} />
                    </div>
                  )}

                  {!skippedIndexesRef.current.has(idx) && (
                    <button className="media-thumb-remove" onClick={(e) => handleCancelSingle(idx, e)}>
                      <X size={10} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* File info */}
        <div className="media-upload-info">
          <span className="media-upload-filename">{currentFile?.name}</span>
          <span className="media-upload-size">{currentFile ? formatSize(currentFile.size) : ''}</span>
        </div>

        {/* Caption per file */}
        <input
          className="media-upload-caption"
          placeholder=""
          value={captions[previewIndex] || ''}
          onChange={(e) => {
            const newCaptions = [...captions];
            newCaptions[previewIndex] = e.target.value;
            setCaptions(newCaptions);
          }}
          disabled={uploading}
        />

        {/* Real progress bar */}
        {uploading && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>Subiendo{fileList.length > 1 ? ` archivos` : ''}...</span>
              <span>{formatSize(uploadedBytes)} / {formatSize(totalSize)} ({overallProgress}%)</span>
            </div>
            <div className="media-upload-progress-bar">
              <div
                className="media-upload-progress-fill"
                style={{ width: `${overallProgress}%`, background: 'linear-gradient(90deg, #FF3737, #CC2222)' }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!uploading && (
          <div className="media-upload-actions">
            {fileList.some(f => f.type.startsWith('video/') || f.type.startsWith('image/')) && (
              <button className="send-btn media-send-video" onClick={() => handleUploadAll('media')}>
                <FileVideo size={16} />
                <span>{fileList.length > 1 ? `Enviar ${fileList.length} archivos` : (isVideo ? 'Enviar video' : 'Enviar imagen')}</span>
              </button>
            )}
            <button className="media-send-file" onClick={() => handleUploadAll('file')}>
              <FileIcon size={16} />
              <span>{fileList.length > 1 ? 'Enviar como archivos' : 'Enviar como archivo'}</span>
            </button>
          </div>
        )}
        {uploading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              <span>Por favor espera, subiendo archivos...</span>
            </div>
            
            <button 
              onClick={handleCancelUpload}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 6,
                fontSize: 13, cursor: 'pointer', fontWeight: 500
              }}
            >
              <XOctagon size={16} /> Cancelar todas las subidas
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
