import { X, Heart } from 'lucide-react';

interface SupportModalProps {
  onClose: () => void;
}

export function SupportModal({ onClose }: SupportModalProps) {
  return (
    <div className="support-modal-overlay" onClick={onClose}>
      <div className="support-modal-content" onClick={(e) => e.stopPropagation()}>

        {/* Animated Particles Background */}
        <div className="particles-container">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>

        <button className="support-modal-close" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>

        <div className="support-modal-header">
          <Heart size={32} className="support-heart-icon" />
          <h2>Apoya nuestro proyecto</h2>
        </div>

        <div className="support-modal-body">
          <div className="support-qr-container">
            <div className="support-qr-placeholder">
               <img src="/IMG_1312.jpeg" alt="QR de apoyo" className="support-qr-image" style={{ width: '100%', height: 'auto', borderRadius: '12px', display: 'block' }} />
            </div>
          </div>

          <div className="support-text-container">
            <p className="support-text-main">
              ¡Tu apoyo nos permite seguir creciendo y ofreciendo más contenido!
            </p>
            <p className="support-text-sub">
              Cualquier contribución, por pequeña que sea, nos ayuda a mejorar la plataforma y adquirir más almacenamiento para que todos disfruten. ¡Gracias de corazón!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
