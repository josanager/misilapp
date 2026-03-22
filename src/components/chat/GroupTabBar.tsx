import { Image, MessageSquare, Hash } from 'lucide-react';

export type GroupTab = 'multimedia' | 'chat' | 'temas';

interface GroupTabBarProps {
  activeTab: GroupTab;
  onChangeTab: (tab: GroupTab) => void;
}

export function GroupTabBar({ activeTab, onChangeTab }: GroupTabBarProps) {
  const tabs: { key: GroupTab; label: string; icon: React.ReactNode }[] = [
    { key: 'multimedia', label: 'Multimedia', icon: <Image size={16} /> },
    { key: 'chat', label: 'Chat', icon: <MessageSquare size={16} /> },
    { key: 'temas', label: 'Temas', icon: <Hash size={16} /> },
  ];

  return (
    <div className="group-tab-bar">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`group-tab-item ${activeTab === tab.key ? 'active' : ''}`}
          onClick={() => onChangeTab(tab.key)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
