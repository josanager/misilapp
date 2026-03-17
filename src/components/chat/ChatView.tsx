import { useEffect, useRef, useState, DragEvent } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useGroupStore } from '../../stores/groupStore';
import { useAuthStore } from '../../stores/authStore';
import { MessageInput } from './MessageInput';
import { Users, Plus, Hash, SmilePlus, Edit2, Trash2, X, ArrowLeft } from 'lucide-react';
import { CreateTopicModal } from '../topics/CreateTopicModal';
import { useLongPress } from '../../hooks/useLongPress';
import { EmojiPicker, ReactionDisplay } from './EmojiPicker';
import { VideoPlayer } from './VideoPlayer';
import { ImageViewer } from './ImageViewer';
import type { Group, Topic, Message } from '../../types';

interface ChatViewProps {
  group: Group;
  topics: Topic[];
  currentTopicId: string | null;
  onSelectTopic: (topic: Topic) => void;
  onToggleGroupPanel: () => void;
  onShowSidebar: () => void;
}

function MessageBubble({ children, onLongPress, onClick }: { children: React.ReactNode, onLongPress: (e: any) => void, onClick: () => void }) {
  const longPressProps = useLongPress(onLongPress, onClick);
  
  return (
    <div 
      className="message-bubble" 
      {...longPressProps}
      style={{ cursor: 'pointer' }}
    >
      {children}
    </div>
  );
}

export function ChatView({ group, topics, currentTopicId, onSelectTopic, onToggleGroupPanel, onShowSidebar }: ChatViewProps) {
  const { 
    messages, loading, fetchMessages, subscribeToMessages, subscribeToPresence, 
    replyTo, setReplyTo, reactions, toggleReaction, subscribeToReactions,
    sendMessage, editMessage, deleteMessage
  } = useChatStore();
  const { members, fetchMembers } = useGroupStore();
  const { user } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ msgId: string, x: number, y: number } | null>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [pendingDropFiles, setPendingDropFiles] = useState<File[] | null>(null);
  
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [optionsMenu, setOptionsMenu] = useState<{
    messageId: string;
    x: number;
    y: number;
    isOwn: boolean;
  } | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const dragCounter = useRef(0);

  useEffect(() => {
    fetchMembers(group.id);
    const unsubPresence = subscribeToPresence(group.id);
    return () => { unsubPresence(); };
  }, [group.id, fetchMembers, subscribeToPresence]);

  useEffect(() => {
    if (currentTopicId) {
      fetchMessages(currentTopicId);
      const unsubMsgs = subscribeToMessages(currentTopicId);
      const unsubReacts = subscribeToReactions(currentTopicId);
      return () => { 
        unsubMsgs(); 
        unsubReacts();
      };
    }
  }, [currentTopicId, fetchMessages, subscribeToMessages, subscribeToReactions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentTopic = topics.find(t => t.id === currentTopicId);
  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Hoy';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  let lastDate = '';
  messages.forEach(msg => {
    const date = new Date(msg.created_at).toDateString();
    if (date !== lastDate) {
      groupedMessages.push({ date: msg.created_at, msgs: [msg] });
      lastDate = date;
    } else {
      groupedMessages[groupedMessages.length - 1].msgs.push(msg);
    }
  });

  const handleContextMenu = (e: any, msg: Message, isOwn: boolean) => {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    
    let clientX = 0;
    let clientY = 0;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.clientX !== undefined) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      // Fallback to center of screen if coordinates missing
      clientX = window.innerWidth / 2;
      clientY = window.innerHeight / 2;
    }

    setShowEmojiPicker(null);
    setOptionsMenu({
      messageId: msg.id,
      x: clientX,
      y: clientY,
      isOwn
    });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (optionsMenu) {
      await deleteMessage(optionsMenu.messageId);
      setOptionsMenu(null);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (optionsMenu) {
      const msgToEdit = messages.find(m => m.id === optionsMenu.messageId);
      if (msgToEdit) {
        setEditingMessageId(msgToEdit.id);
        setEditingContent(msgToEdit.content || msgToEdit.file_name || '');
        setReplyTo(null);
      }
      setOptionsMenu(null);
    }
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleSend = async (content: string, type: 'text' | 'image' | 'video' | 'file' = 'text', fileUrl?: string, fileName?: string, fileSize?: number, mediaGroupId?: string) => {
    if (editingMessageId) {
      const success = await editMessage(editingMessageId, content);
      if (success) cancelEditing();
      return;
    }
    
    if (!currentTopicId) return;

    //@ts-ignore
    const success = await sendMessage(currentTopicId, content, type, fileUrl, fileName, fileSize, mediaGroupId);
    if (success) {
      if (replyTo) setReplyTo(null);
      // scroll is handled by useEffect on messages change
    }
  };

  // Full-window drag and drop handlers
  const handleWindowDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setDraggingFiles(true);
  };

  const handleWindowDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDraggingFiles(false);
  };

  const handleWindowDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDraggingFiles(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setPendingDropFiles(files);
  };

  const processReactions = (msgId: string) => {
    const msgReactions = reactions[msgId] || [];
    const grouped = new Map<string, { count: number; users: string[]; reacted: boolean }>();
    
    msgReactions.forEach(r => {
      const existing = grouped.get(r.emoji) || { count: 0, users: [], reacted: false };
      const profile = members.find(m => m.user_id === r.user_id)?.profile;
      const userName = profile?.display_name || profile?.username || 'Usuario';
      
      existing.count++;
      existing.users.push(userName);
      if (r.user_id === user?.id) existing.reacted = true;
      
      grouped.set(r.emoji, existing);
    });

    return Array.from(grouped.entries()).map(([emoji, data]) => ({ emoji, ...data }));
  };

  return (
    <div
      style={{ display: 'contents' }}
      onDragEnter={handleWindowDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleWindowDrop}
    >
    {/* Full-window drag overlay */}
    {draggingFiles && (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(106,178,242,0.12)',
        border: '3px dashed #6AB2F2', borderRadius: 16, zIndex: 999,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16, pointerEvents: 'none'
      }}>
        <div style={{ fontSize: 52 }}>📎</div>
        <p style={{ color: '#6AB2F2', fontWeight: 700, fontSize: 20 }}>Suelta aquí para adjuntar</p>
        <p style={{ color: 'rgba(106,178,242,0.7)', fontSize: 14 }}>Puedes soltar varios archivos a la vez</p>
      </div>
    )}
      <header className="chat-header">
        <div className="chat-header-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              className="btn-icon mobile-back-btn show-on-mobile"
              onClick={() => {
                onShowSidebar();
              }}
              title="Volver a chats"
              style={{ padding: '8px 4px', marginRight: 0 }}
            >
              <ArrowLeft size={24} />
            </button>
            <div className="group-avatar" style={{ width: 40, height: 40 }}>
              {getInitials(group.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0 }}>{group.name}</h3>
              <p style={{ margin: 0, opacity: 0.7, fontSize: 12 }}>
                {members.length} miembros • {currentTopic?.name || 'Sin tema'}
              </p>
            </div>
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="btn-icon" onClick={onToggleGroupPanel} title="Información del grupo">
            <Users size={20} />
          </button>
        </div>
      </header>

      {/* Topic tabs */}
      {topics.length > 0 && (
        <div className="topic-tabs">
          {topics.map(topic => (
            <button
              key={topic.id}
              className={`topic-tab ${topic.id === currentTopicId ? 'active' : ''}`}
              onClick={() => onSelectTopic(topic)}
            >
              <Hash size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {topic.name}
            </button>
          ))}
          <button className="topic-tab-add" onClick={() => setShowCreateTopic(true)}>
            <Plus size={14} /> Tema
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="messages-area">
        {loading ? (
          <div className="loader"><div className="spinner" /></div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Hash size={32} />
            </div>
            <h3>{currentTopic?.name || 'General'}</h3>
            <p>No hay mensajes aún. ¡Sé el primero en escribir!</p>
          </div>
        ) : (
          groupedMessages.map(({ date, msgs }) => (
            <div key={date} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="date-divider">
                <span>{formatDate(date)}</span>
              </div>
              {msgs.map((msg, idx) => {
                const isOwn = msg.user_id === user?.id;
                const prevMsg = idx > 0 ? msgs[idx - 1] : null;
                const isChain = prevMsg && prevMsg.user_id === msg.user_id && 
                  (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000);
                  
                const senderName = msg.profile?.display_name || msg.profile?.username || 'Usuario';
                const repliedMsg = msg.replied_to ? messages.find(m => m.id === msg.replied_to) : null;

                // Media Group Detection: Check if this message is the start of a group
                if (msg.media_group_id && idx > 0 && msgs[idx-1].media_group_id === msg.media_group_id) {
                  return null; // Already rendered by the first message in the group
                }

                const mediaGroup = msg.media_group_id 
                  ? msgs.filter(m => m.media_group_id === msg.media_group_id && m.user_id === msg.user_id)
                  : [msg];

                const isGroup = mediaGroup.length > 1;

                return (
                  <div 
                    key={msg.id} 
                    className={`message ${isOwn ? 'own' : ''} ${isChain ? 'chain' : ''}`}
                    onContextMenu={(e) => handleContextMenu(e, msg, isOwn)}
                  >
                    {!isOwn && (
                      <div className="message-avatar" style={{ visibility: isChain ? 'hidden' : 'visible' }}>
                        {getInitials(senderName)}
                      </div>
                    )}
                    <div className="message-wrapper">
                      <MessageBubble 
                        onLongPress={(e) => handleContextMenu(e, msg, isOwn)}
                        onClick={() => setReplyTo(msg)}
                      >
                        <button 
                          className="message-react-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEmojiPicker({ 
                              msgId: msg.id, 
                              x: e.clientX, 
                              y: e.clientY 
                            });
                          }}
                        >
                          <SmilePlus size={16} />
                        </button>
                        
                        {!isOwn && !isChain && <div className="message-sender">{senderName}</div>}
                        {repliedMsg && (
                          <div className="message-reply">
                            ↩ {repliedMsg.profile?.display_name || repliedMsg.profile?.username}: {repliedMsg.content?.substring(0, 50)}
                          </div>
                        )}

                        {isGroup ? (
                          <div className={`media-group-grid count-${mediaGroup.length > 5 ? '6' : mediaGroup.length}`}>
                            {mediaGroup.slice(0, 6).map((m, idx) => (
                              <div key={m.id} className="grid-item">
                                {m.type === 'image' && m.file_url && (
                                  <img 
                                    src={m.file_url} 
                                    alt="Media" 
                                    loading="lazy" 
                                    style={{ cursor: 'pointer' }} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedImageUrl(m.file_url!);
                                    }}
                                  />
                                )}
                                {m.type === 'video' && m.file_url && (
                                  <VideoPlayer src={m.file_url} previewMode={true} />
                                )}
                                {mediaGroup.length > 6 && idx === 5 && (
                                  <div style={{
                                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontWeight: 700, fontSize: 20, pointerEvents: 'none'
                                  }}>
                                    +{mediaGroup.length - 6}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {msg.type === 'text' && (
                              <div className="message-content">{msg.content}</div>
                            )}
                            {msg.type === 'image' && msg.file_url && (
                              <div className="message-file">
                                <img 
                                  src={msg.file_url} 
                                  alt="Image" 
                                  loading="lazy" 
                                  style={{ borderRadius: 10, maxWidth: '100%', maxHeight: 400, display: 'block', cursor: 'pointer' }} 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedImageUrl(msg.file_url!);
                                  }}
                                />
                                {msg.content && msg.content !== msg.file_name && (
                                  <div className="message-caption">{msg.content}</div>
                                )}
                              </div>
                            )}
                            {msg.type === 'video' && msg.file_url && (
                              <div className="message-file">
                                <VideoPlayer src={msg.file_url} previewMode={true} style={{ maxWidth: 400, width: '100%', borderRadius: 10 }} />
                                {msg.content && msg.content !== msg.file_name && (
                                  <div className="message-caption">{msg.content}</div>
                                )}
                              </div>
                            )}
                            {msg.type === 'file' && msg.file_url && (
                              <a
                                href={msg.file_url}
                                target="_blank"
                                rel="noopener"
                                className="message-file-card"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="message-file-icon">📄</div>
                                <div className="message-file-details">
                                  <div className="message-file-name">
                                    {msg.file_name || msg.content || 'Archivo'}
                                  </div>
                                  {msg.file_size && (
                                    <div className="message-file-size">
                                      {msg.file_size < 1024 * 1024
                                        ? (msg.file_size / 1024).toFixed(1) + ' KB'
                                        : (msg.file_size / 1024 / 1024).toFixed(2) + ' MB'}
                                    </div>
                                  )}
                                  {msg.content && msg.content !== msg.file_name && (
                                    <div className="message-file-caption">{msg.content}</div>
                                  )}
                                </div>
                                <div className="message-file-download">⬇</div>
                              </a>
                            )}
                          </>
                        )}

                        {/* Caption for the whole group or single item */}
                        {isGroup && mediaGroup.some(m => m.content && m.content !== m.file_name) && (
                          <div className="media-group-caption" style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            {mediaGroup
                              .filter(m => m.content && m.content !== m.file_name)
                              .map(m => m.content)
                              .reduce((acc, curr) => acc.includes(curr) ? acc : [...acc, curr], [] as string[]) // Deduplicate captions
                              .join(' • ')}
                          </div>
                        )}

                        <div className="message-time">
                          {formatTime(msg.created_at)}
                          {msg.is_edited && <span style={{fontSize: '0.85em', opacity: 0.7, marginLeft: '4px'}}>(editado)</span>}
                        </div>
                      </MessageBubble>
                      
                      <ReactionDisplay 
                        reactions={processReactions(msg.id)} 
                        onToggle={(emoji) => toggleReaction(msg.id, emoji)}
                      />
                    </div>
                    {isOwn && (
                      <div className="message-avatar" style={{ visibility: isChain ? 'hidden' : 'visible' }}>
                        {getInitials(senderName)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {editingMessageId && (
        <div className="edit-preview" style={{ padding: '8px 16px', background: 'var(--surface-dark)', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
              <Edit2 size={12} style={{marginRight: '6px'}}/> Editando mensaje
            </span>
            <button onClick={cancelEditing} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
               <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Options Menu Popup & Overlay */}
      {optionsMenu && (
        <>
          <div 
            className="menu-overlay"
            onClick={() => setOptionsMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setOptionsMenu(null); }}
          />
          <div 
            className="options-menu-popup dropdown-panel"
          style={{
            position: 'fixed',
            left: Math.min(optionsMenu.x, window.innerWidth - 160),
            top: Math.min(optionsMenu.y, window.innerHeight - (optionsMenu.isOwn ? 120 : 60)),
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            padding: '6px',
            background: 'var(--surface-dark)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dropdown-item" onClick={(e) => { e.stopPropagation(); setReplyTo(messages.find(m => m.id === optionsMenu.messageId) || null); setOptionsMenu(null); }}>
             <span>↩️ Responder</span>
          </div>
          {optionsMenu.isOwn && (
            <>
              <div className="dropdown-item" onClick={handleEdit}>
                <Edit2 size={16} style={{marginRight: '8px'}} />
                <span>Editar</span>
              </div>
              <div className="dropdown-item text-danger" onClick={handleDelete} style={{ color: '#ff4b4b' }}>
                <Trash2 size={16} style={{marginRight: '8px'}} />
                <span>Eliminar</span>
              </div>
            </>
          )}
        </div>
        </>
      )}

      {/* Message input */}
      {currentTopicId && (
        <MessageInput
          topicId={currentTopicId || ''}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          pendingFiles={pendingDropFiles}
          onClearPendingFiles={() => setPendingDropFiles(null)}
          editingContent={editingContent}
          onSendMessage={handleSend}
        />
      )}

      {showCreateTopic && (
        <CreateTopicModal
          groupId={group.id}
          onClose={() => setShowCreateTopic(false)}
        />
      )}

      {showEmojiPicker && (
        <EmojiPicker
          position={{ x: showEmojiPicker.x, y: showEmojiPicker.y }}
          onSelect={(emoji) => {
            toggleReaction(showEmojiPicker.msgId, emoji);
            setShowEmojiPicker(null);
          }}
          onClose={() => setShowEmojiPicker(null)}
        />
      )}

      {selectedImageUrl && (
        <ImageViewer 
          src={selectedImageUrl} 
          onClose={() => setSelectedImageUrl(null)} 
        />
      )}
    </div>
  );
}
