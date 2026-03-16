import { useEffect } from 'react';
import { X, Download, Maximize2 } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  onClose: () => void;
}

export function ImageViewer({ src, onClose }: ImageViewerProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      <div className="image-viewer-toolbar">
        <button className="btn-icon" onClick={(e) => {
          e.stopPropagation();
          window.open(src, '_blank');
        }} title="Abrir original">
          <Maximize2 size={20} />
        </button>
        <a 
          href={src} 
          download 
          className="btn-icon" 
          onClick={e => e.stopPropagation()} 
          title="Descargar"
        >
          <Download size={20} />
        </a>
        <button className="btn-icon" onClick={onClose} title="Cerrar">
          <X size={20} />
        </button>
      </div>
      
      <div className="image-viewer-content" onClick={e => e.stopPropagation()}>
        <img src={src} alt="Full screen" className="full-screen-image" />
      </div>
    </div>
  );
}
