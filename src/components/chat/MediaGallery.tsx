import { useEffect, useState, useCallback } from 'react';
import { useGroupStore, type MediaFilter } from '../../stores/groupStore';
import { SlidersHorizontal, Star, Eye, Clock, Play } from 'lucide-react';
import { getUserColor } from '../../lib/avatar';

interface MediaGalleryProps {
  groupId: string;
  onSelectMedia: (media: any) => void;
}

const FILTER_OPTIONS: { key: MediaFilter; label: string; icon: React.ReactNode }[] = [
  { key: 'recent', label: 'Recientes', icon: <Clock size={14} /> },
  { key: 'top_rated', label: 'Mejor Puntuados', icon: <Star size={14} /> },
  { key: 'most_viewed', label: 'Más Vistos', icon: <Eye size={14} /> },
];

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function MediaGallery({ groupId, onSelectMedia }: MediaGalleryProps) {
  const { groupMedia, fetchGroupMedia, mediaFilter, setMediaFilter, mediaRatings, fetchMediaRatings } = useGroupStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchGroupMedia(groupId).then(() => setLoading(false));
  }, [groupId, fetchGroupMedia]);

  // Fetch ratings once media is loaded
  useEffect(() => {
    if (groupMedia.length > 0) {
      const mediaIds = groupMedia
        .filter((m: any) => m.type === 'image' || m.type === 'video')
        .map((m: any) => m.id);
      if (mediaIds.length > 0) fetchMediaRatings(mediaIds);
    }
  }, [groupMedia, fetchMediaRatings]);

  // Filter only images and videos
  const mediaOnly = groupMedia.filter((m: any) => m.type === 'image' || m.type === 'video');

  // Apply sort based on current filter
  const sortedMedia = useCallback(() => {
    const items = [...mediaOnly];
    switch (mediaFilter) {
      case 'top_rated':
        return items.sort((a, b) => {
          const rA = mediaRatings[a.id]?.avg || 0;
          const rB = mediaRatings[b.id]?.avg || 0;
          return rB - rA;
        });
      case 'most_viewed':
        return items.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
      case 'recent':
      default:
        return items.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  }, [mediaOnly, mediaFilter, mediaRatings])();

  if (loading) {
    return (
      <div className="media-gallery-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="media-gallery-container">
      {/* Filter Bar */}
      <div className="media-filter-bar">
        <SlidersHorizontal size={14} style={{ opacity: 0.6 }} />
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.key}
            className={`media-filter-btn ${mediaFilter === opt.key ? 'active' : ''}`}
            onClick={() => setMediaFilter(opt.key)}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Masonry Grid */}
      {sortedMedia.length === 0 ? (
        <div className="media-gallery-empty">
          <p>No hay contenido multimedia en este grupo aún</p>
        </div>
      ) : (
        <div className="media-masonry">
          {sortedMedia.map((item: any) => {
            const uploaderName = item.profile?.display_name || item.profile?.username || 'U';
            const uploaderAvatar = item.profile?.avatar_url;
            const uploaderColor = getUserColor(item.user_id);

            return (
              <div
                key={item.id}
                className="media-masonry-item"
                onClick={() => onSelectMedia(item)}
              >
                {item.type === 'image' && item.file_url && (
                  <img
                    src={item.file_url}
                    alt={item.content || 'Media'}
                    loading="lazy"
                  />
                )}
                {item.type === 'video' && item.file_url && (
                  <div className="media-masonry-video">
                    <video
                      src={item.file_url}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      onMouseEnter={e => (e.target as HTMLVideoElement).play().catch(() => {})}
                      onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                    />
                    <div className="media-masonry-play">
                      <Play size={20} fill="white" />
                    </div>
                  </div>
                )}

                {/* Rating badge */}
                {mediaRatings[item.id]?.avg > 0 && (
                  <div className="media-masonry-rating">
                    <Star size={10} fill="#fbbf24" color="#fbbf24" />
                    <span>{mediaRatings[item.id].avg}</span>
                  </div>
                )}

                {/* View count badge */}
                {(item.view_count || 0) > 0 && (
                  <div className="media-masonry-views">
                    <Eye size={10} />
                    <span>{item.view_count}</span>
                  </div>
                )}

                {/* Uploader avatar */}
                <div className="media-masonry-uploader">
                  {uploaderAvatar ? (
                    <img src={uploaderAvatar} alt={uploaderName} />
                  ) : (
                    <div className="media-masonry-uploader-initials" style={{ background: uploaderColor }}>
                      {getInitials(uploaderName)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
