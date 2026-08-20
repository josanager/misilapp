import { useEffect, useState } from 'react';
import { X, Star, Eye, Clock } from 'lucide-react';
import { useGroupStore } from '../../stores/groupStore';
import { getUserColor } from '../../lib/avatar';
import { VideoPlayer } from './VideoPlayer';
import type { Message } from '../../types';

interface MediaViewerProps {
  media: Message;
  onClose: () => void;
}

export function MediaViewer({ media, onClose }: MediaViewerProps) {
  const { mediaRatings, rateMedia, incrementViewCount } = useGroupStore();
  const [hoverRating, setHoverRating] = useState(0);

  const rating = mediaRatings[media.id];
  const userRating = rating?.userRating || 0;
  const avgRating = rating?.avg || 0;
  const ratingCount = rating?.count || 0;

  const senderName = media.profile?.display_name || media.profile?.username || 'Usuario';
  const initials = senderName.slice(0, 2).toUpperCase();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Increment view count on open
  useEffect(() => {
    incrementViewCount(media.id);
  }, [media.id, incrementViewCount]);

  const handleRate = (value: number) => {
    rateMedia(media.id, value);
  };

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="media-viewer-overlay" onClick={onClose}>
      <div className="media-viewer-container" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button className="media-viewer-close" onClick={onClose}>
          <X size={24} />
        </button>

        {/* Media content */}
        <div className="media-viewer-content">
          {media.type === 'video' && media.file_url ? (
            <VideoPlayer
              src={media.file_url}
              style={{ width: '100%', maxHeight: '70vh', borderRadius: '12px' }}
            />
          ) : media.type === 'image' && media.file_url ? (
            <img
              src={media.file_url}
              alt={media.content || 'Media'}
              className="media-viewer-image"
            />
          ) : null}
        </div>

        {/* Info panel */}
        <div className="media-viewer-info">
          {/* Uploader info */}
          <div className="media-viewer-uploader">
            <div
              className="media-viewer-avatar"
              style={{ background: getUserColor(media.user_id) }}
            >
              {initials}
            </div>
            <div className="media-viewer-uploader-details">
              <span className="media-viewer-name">{senderName}</span>
              <span className="media-viewer-date">
                <Clock size={12} />
                {formatDate(media.created_at)}
              </span>
            </div>
          </div>

          {/* Caption */}
          {media.content && media.content !== media.file_name && (
            <p className="media-viewer-caption">{media.content}</p>
          )}

          {/* Stats row */}
          <div className="media-viewer-stats">
            <div className="media-viewer-stat">
              <Eye size={14} />
              <span>{media.view_count || 0} vistas</span>
            </div>
            {avgRating > 0 && (
              <div className="media-viewer-stat">
                <Star size={14} fill="#fbbf24" color="#fbbf24" />
                <span>{avgRating} ({ratingCount})</span>
              </div>
            )}
          </div>

          {/* Rating */}
          <div className="media-viewer-rating">
            <span className="media-viewer-rating-label">Puntúa este contenido</span>
            <div className="media-viewer-stars">
              {[1, 2, 3, 4, 5].map(value => (
                <button
                  key={value}
                  className={`media-viewer-star ${
                    (hoverRating || userRating) >= value ? 'filled' : ''
                  }`}
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => handleRate(value)}
                >
                  <Star
                    size={24}
                    fill={(hoverRating || userRating) >= value ? '#fbbf24' : 'transparent'}
                    color={(hoverRating || userRating) >= value ? '#fbbf24' : 'var(--text-muted)'}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
