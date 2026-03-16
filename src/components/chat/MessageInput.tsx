import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { Send, Paperclip, X } from 'lucide-react';
import type { Message } from '../../types';
import { MediaUploadModal } from './MediaUploadModal';

interface MessageInputProps {
  topicId: string;
  replyTo: Message | null;
  onCancelReply: () => void;
  pendingFiles?: File[] | null;
  onClearPendingFiles?: () => void;
  editingContent?: string;
  onSendMessage: (content: string, type?: 'text' | 'image' | 'video' | 'file', fileUrl?: string, fileName?: string, fileSize?: number, mediaGroupId?: string) => void;
}

export function MessageInput({ topicId, replyTo, onCancelReply, pendingFiles, onClearPendingFiles, editingContent, onSendMessage }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [localFiles, setLocalFiles] = useState<File[] | null>(null);
  const { sending } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Files can come from local selection or parent (drag-and-drop from ChatView)
  const activeFiles = pendingFiles || localFiles;
  
  // Update content when editingContent prop changes
  useEffect(() => {
    if (editingContent !== undefined) {
      setContent(editingContent);
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Trigger auto-resize after a tiny delay
        setTimeout(handleTextareaInput, 10);
      }
    }
  }, [editingContent]);

  const handleSend = async () => {
    if (!content.trim()) return;
    const messageContent = content.trim();
    
    // Clear the input and reset height
    setContent('');
    if (textareaRef.current) textareaRef.current.style.height = '44px';
    
    // Call the parent's onSendMessage which handles both new messages and edits
    onSendMessage(messageContent, 'text');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTextareaInput = () => {
    const el = textareaRef.current;
    if (el) { 
      el.style.height = '44px'; 
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'; 
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) setLocalFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeModal = () => {
    setLocalFiles(null);
    onClearPendingFiles?.();
  };

  return (
    <>
      {activeFiles && activeFiles.length > 0 && (
        <MediaUploadModal files={activeFiles} topicId={topicId} onClose={closeModal} />
      )}
      <div className="message-input-area">
        {replyTo && (
          <div className="reply-preview">
            <span>↩ Respondiendo a <b>{replyTo.profile?.display_name || replyTo.profile?.username}</b>: {replyTo.content?.substring(0, 60)}</span>
            <button className="btn-icon" onClick={onCancelReply} style={{ padding: 4 }}><X size={16} /></button>
          </div>
        )}
        <div className="message-input-row">
          <button className="btn-icon" onClick={() => fileInputRef.current?.click()} title="Adjuntar archivo">
            <Paperclip size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
          />
          <textarea
            ref={textareaRef}
            className="message-input"
            placeholder=""
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            rows={1}
            disabled={sending}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!content.trim() || sending}
            title="Enviar"
          >
            {sending ? (
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </>
  );
}
