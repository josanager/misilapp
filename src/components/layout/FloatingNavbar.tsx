import { MessageSquare, User, Settings } from 'lucide-react';

export type MainTab = 'chat' | 'profile' | 'settings';

interface FloatingNavbarProps {
  currentTab: MainTab;
  onChangeTab: (tab: MainTab) => void;
}

export function FloatingNavbar({ currentTab, onChangeTab }: FloatingNavbarProps) {
  return (
    <div className="floating-navbar-container">
      <nav className="floating-navbar">
        <button 
          className={`nav-tab ${currentTab === 'chat' ? 'active' : ''}`}
          onClick={() => onChangeTab('chat')}
          title="Chats"
        >
          <MessageSquare size={24} />
        </button>
        
        <button 
          className={`nav-tab ${currentTab === 'profile' ? 'active' : ''}`}
          onClick={() => onChangeTab('profile')}
          title="Perfil"
        >
          <User size={24} />
        </button>
        
        <button 
          className={`nav-tab ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => onChangeTab('settings')}
          title="Configuración"
        >
          <Settings size={24} />
        </button>
      </nav>
    </div>
  );
}
