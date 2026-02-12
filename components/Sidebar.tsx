
import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  FileText,
  ScrollText,
  ShieldAlert,
  Puzzle,
  Settings,
  Lock,
  LogOut,
  Waves,
  Terminal,
  FlaskConical,
  Clock9,
  Truck,
  DollarSign,
  Fingerprint,
  Layers,
  BookOpen,
  Sparkles,
  BarChart3,
  Globe,
  Heart,
  MessageCircleQuestion,
  Users,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  BookUser,
  Mail,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { AppView, GatewayStatus, UserIdentity, NavigationItem, ShellConfig, PersonaType } from '../types';
import { gatewayService } from '../services/gatewayService';
import { activityService } from '../services/activityService';
import { PERSONA_PRESETS } from '../personas';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  navLayout: NavigationItem[];
  shellConfig?: ShellConfig | null;
  onSwitchPersona?: (personaId: PersonaType) => void;
  onLogout?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const iconMap: Record<string, any> = {
  [AppView.DASHBOARD]: LayoutDashboard,
  [AppView.TASKS]: CheckSquare,
  [AppView.PROJECTS]: Layers,
  [AppView.SCRAPBOOK]: BookOpen,
  [AppView.CALENDAR]: Calendar,
  [AppView.DOCUMENTS]: FileText,
  [AppView.CONTRACTS]: ScrollText,
  [AppView.LICENSES]: ShieldAlert,
  [AppView.ACCOUNTING]: DollarSign,

  [AppView.ASSETS]: Truck,
  [AppView.SKILLS]: Puzzle,
  [AppView.SETTINGS]: Settings,
  [AppView.SECRETS]: Lock,
  [AppView.TERMINAL]: Terminal,
  [AppView.STRATEGY_SANDBOX]: FlaskConical,
  [AppView.COMPLIANCE]: Clock9,
  [AppView.MISSION_LOG]: Fingerprint,
  [AppView.ECONOMY]: BarChart3,

  [AppView.QUESTIONS]: MessageCircleQuestion,
  [AppView.ADDRESS_BOOK]: BookUser,
  [AppView.EMAIL]: Mail,
  [AppView.AGENTS]: Bot,
};

const LobsterClawIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white relative z-10">
    <path d="M12 2C12 2 7 3 5 8C3 13 4 17 8 20C12 23 16 23 20 20C24 17 25 13 23 8C21 3 16 2 16 2" />
    <path d="M9 10C9 10 7 11 7 13C7 15 9 16 9 16" />
    <path d="M15 10C15 10 17 11 17 13C17 15 15 16 15 16" />
    <path d="M12 18V22" />
  </svg>
);

interface NavItemProps {
  item: NavigationItem;
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  level?: number;
  collapsed?: boolean;
}

const NavItemRenderer: React.FC<NavItemProps> = ({ item, currentView, onChangeView, level = 0, collapsed = false }) => {
  const isActive = currentView === item.view;
  const Icon = iconMap[item.view] || Globe;
  const hasChildren = item.children && item.children.length > 0;
  const isParent = level === 0 && hasChildren;

  const isChildActive = hasChildren && item.children?.some(child => child.view === currentView);
  // Only expand if this section or a child is active (collapsed by default)
  const [isExpanded, setIsExpanded] = useState(isChildActive || isActive);

  useEffect(() => {
    if (isChildActive || isActive) setIsExpanded(true);
  }, [isChildActive, isActive]);

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
      onChangeView(item.view);
    } else {
      onChangeView(item.view);
    }
  };

  // Collapsed mode — just show icon
  if (collapsed) {
    return (
      <div className="mb-px">
        <button
          onClick={handleClick}
          title={item.label}
          className={`w-full flex items-center justify-center py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden
                      ${isActive || isChildActive
              ? 'text-white bg-white/[0.06]'
              : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
            }`}
        >
          {(isActive || isChildActive) && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ backgroundColor: 'hsl(var(--shell-accent))', boxShadow: '0 0 8px hsl(var(--shell-accent) / 0.4)' }}></div>
          )}
          <Icon className={`w-[16px] h-[16px] shrink-0 transition-all duration-200 ${isActive || isChildActive ? '' : 'group-hover:scale-110'}`} style={(isActive || isChildActive) ? { color: 'hsl(var(--shell-accent))' } : {}} />
        </button>
        {/* Show children as separate icons when collapsed */}
        {hasChildren && (isActive || isChildActive) && item.children!.sort((a, b) => a.order - b.order).map(child => (
          <NavItemRenderer key={child.view} item={child} currentView={currentView} onChangeView={onChangeView} level={level + 1} collapsed={collapsed} />
        ))}
      </div>
    );
  }

  // Parent section header style vs child item style
  if (isParent) {
    return (
      <div className="mt-3 first:mt-0">
        <button
          onClick={handleClick}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.12em] transition-all duration-200 group relative overflow-hidden
                      ${isActive || isChildActive
              ? 'text-white/70'
              : 'text-white/25 hover:text-white/50'
            }`}
        >
          {(isActive || isChildActive) && (
            <div className="absolute left-0 top-[6px] bottom-[6px] w-[2px] rounded-r-full opacity-40" style={{ backgroundColor: 'hsl(var(--shell-accent))' }}></div>
          )}
          <Icon className={`w-[13px] h-[13px] shrink-0 transition-all duration-200 ${isActive || isChildActive ? 'opacity-60' : 'opacity-30 group-hover:opacity-50'}`} style={(isActive || isChildActive) ? { color: 'hsl(var(--shell-accent))' } : {}} />
          <span className="truncate flex-1">{item.label}</span>
          <div className="opacity-25 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0)' : 'rotate(-90deg)' }}>
            <ChevronDown className="w-3 h-3" />
          </div>
        </button>

        {isExpanded && (
          <div className="mt-0.5 space-y-px ml-1 relative">
            <div className="absolute left-[22px] top-1 bottom-1 w-px bg-white/[0.04]"></div>
            {item.children!.sort((a, b) => a.order - b.order).map(child => (
              <NavItemRenderer
                key={child.view}
                item={child}
                currentView={currentView}
                onChangeView={onChangeView}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Child items & top-level items without children
  const isChild = level > 0;
  return (
    <div className="mb-px">
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden
                    ${isChild ? 'px-4 py-[7px] text-[11px] font-semibold tracking-wide' : 'px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide'}
                    ${isActive
            ? 'text-white bg-white/[0.06]'
            : isChild
              ? 'text-white/35 hover:text-white/65 hover:bg-white/[0.02]'
              : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
          }`}
        style={{ paddingLeft: isChild ? `${(level * 12) + 24}px` : `${16}px` }}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ backgroundColor: 'hsl(var(--shell-accent))', boxShadow: '0 0 8px hsl(var(--shell-accent) / 0.4)' }}></div>
        )}

        <Icon className={`shrink-0 z-10 transition-all duration-200 ${isChild ? 'w-[13px] h-[13px]' : 'w-[15px] h-[15px]'} ${isActive ? '' : 'text-current group-hover:scale-110'}`} style={isActive ? { color: 'hsl(var(--shell-accent))' } : {}} />
        <span className={`truncate flex-1 z-10 ${isChild ? '' : 'uppercase'}`}>{item.label}</span>
        {hasChildren && (
          <div className="opacity-30 z-10 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0)' : 'rotate(-90deg)' }}>
            <ChevronDown className="w-3 h-3" />
          </div>
        )}
      </button>

      {hasChildren && isExpanded && (
        <div className="mt-0.5 space-y-px relative ml-2">
          <div className="absolute left-[18px] top-0 bottom-2 w-px bg-white/[0.04]" style={{ left: `${(level * 12) + 18}px` }}></div>
          {item.children!.sort((a, b) => a.order - b.order).map(child => (
            <NavItemRenderer
              key={child.view}
              item={child}
              currentView={currentView}
              onChangeView={onChangeView}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, navLayout, shellConfig, onSwitchPersona, onLogout, collapsed = false, onToggleCollapse }) => {
  const [gwStatus, setGwStatus] = useState<GatewayStatus>('DISCOVERING');
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);

  useEffect(() => {
    const unsubscribeStatus = gatewayService.subscribe(setGwStatus);
    const unsubscribeIdentity = gatewayService.subscribeIdentity(setIdentity);
    const unsubscribeThinking = activityService.subscribeState(setIsBotThinking);
    return () => {
      unsubscribeStatus();
      unsubscribeIdentity();
      unsubscribeThinking();
    };
  }, []);

  const sortedNav = [...navLayout]
    .filter(item => !item.isHidden)
    .sort((a, b) => a.order - b.order);

  const soul = identity?.soul || 'assistant';
  const colors: Record<string, string> = { assistant: 'text-blue-400', trader: 'text-emerald-400', business: 'text-rose-400' };
  const activePreset = PERSONA_PRESETS.find(p => p.id === shellConfig?.persona);

  return (
    <div className={`${collapsed ? 'w-16' : 'w-60'} flex flex-col h-full shrink-0 z-20 border-r border-white/[0.04] bg-[#0a0e1a]/80 backdrop-blur-xl overflow-hidden transition-all duration-300`}>
      {/* Logo area */}
      <div className={`${collapsed ? 'px-3 pt-4 pb-2' : 'px-6 pt-6 pb-3'} flex items-center ${collapsed ? 'justify-center' : 'gap-3'} group cursor-pointer shrink-0`} onClick={() => onChangeView(AppView.DASHBOARD)}>
        <div className={`${collapsed ? 'w-8 h-8' : 'w-9 h-9'} rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden shrink-0 group-hover:scale-105 transition-transform border border-white/10`} style={{ background: shellConfig ? `linear-gradient(135deg, hsl(${shellConfig.accentColor}), hsl(${shellConfig.accentColor} / 0.7))` : 'linear-gradient(135deg, #f43f5e, #be123c)' }}>
          <LobsterClawIcon />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex flex-col">
            <h1 className="font-bold text-base tracking-tight text-white leading-none">{shellConfig?.shellName || 'ClawKeep'}</h1>
            <p className="text-[9px] text-white/25 font-mono mt-0.5 truncate">{identity?.name?.split(' ')[0] || 'Shell OS'}</p>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-5 py-2">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"></div>
        </div>
      )}

      {/* Persona Switcher — hidden when collapsed */}
      {!collapsed && onSwitchPersona && (
        <div className="px-3 pb-2 relative">
          <button
            onClick={() => setShowPersonaPicker(!showPersonaPicker)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all group"
          >
            <span className="text-lg leading-none">{activePreset?.icon || '🦀'}</span>
            <div className="flex-1 text-left min-w-0">
              <div className="text-[10px] font-bold text-white truncate">{activePreset?.label || 'Unknown'}</div>
              <div className="text-[8px] text-white/25 font-mono uppercase tracking-wider">Scene</div>
            </div>
            <ChevronDown className={`w-3 h-3 text-white/20 transition-transform duration-200 ${showPersonaPicker ? 'rotate-180' : ''}`} />
          </button>

          {showPersonaPicker && (
            <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-[#0d1117] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
              {PERSONA_PRESETS.map(p => {
                const isActive = shellConfig?.persona === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => { onSwitchPersona(p.id); setShowPersonaPicker(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${isActive ? 'bg-white/[0.08] text-white' : 'text-white/50 hover:bg-white/[0.04] hover:text-white'
                      }`}
                  >
                    <span className="text-lg leading-none">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold truncate">{p.label}</div>
                      <div className="text-[8px] text-white/25 font-mono truncate">{p.description}</div>
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <nav className={`flex-1 ${collapsed ? 'px-1.5' : 'px-2.5'} py-1 overflow-y-auto scrollbar-hide`}>
        {sortedNav.map((item) => (
          <NavItemRenderer
            key={item.view}
            item={item}
            currentView={currentView}
            onChangeView={onChangeView}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Collapse toggle */}
      {onToggleCollapse && (
        <div className={`${collapsed ? 'px-1.5' : 'px-3'} py-1`}>
          <button
            onClick={onToggleCollapse}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2 px-3'} py-2 rounded-xl hover:bg-white/[0.04] text-white/20 hover:text-white/50 transition-all group`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4 transition-transform group-hover:scale-110" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Collapse</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Status footer */}
      <div className={`${collapsed ? 'px-2 py-3' : 'px-5 py-4'} mt-auto shrink-0 border-t border-white/[0.04]`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isBotThinking ? 'animate-pulse' : 'bg-emerald-500'}`} style={isBotThinking ? { backgroundColor: 'hsl(var(--shell-accent))' } : {}} title={isBotThinking ? 'Processing...' : 'Online'}></div>
            {onLogout ? (
              <button onClick={onLogout} className="p-1.5 hover:bg-rose-500/10 rounded-lg text-white/40 hover:text-rose-400 transition-colors" title="Log Out">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button onClick={() => gatewayService.disconnect()} className="p-1.5 hover:bg-white/5 rounded-lg text-white/15 hover:text-white/40 transition-colors" title="Disconnect">
                <Lock className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isBotThinking ? 'animate-pulse' : 'bg-emerald-500'}`} style={isBotThinking ? { backgroundColor: 'hsl(var(--shell-accent))' } : {}}></div>
              <div className="flex flex-col">
                <span className={`text-[10px] font-semibold ${colors[soul]}`}>
                  {isBotThinking ? "Processing..." : "Online"}
                </span>
                <span className="text-[9px] font-mono text-white/20">
                  {gwStatus === 'CONNECTED' ? 'VPS Connected' : 'Local Mode'}
                </span>
              </div>
            </div>
            {onLogout ? (
              <button onClick={onLogout} className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-rose-500/10 rounded-lg text-white/40 hover:text-rose-400 transition-colors" title="Log Out">
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[9px] font-semibold uppercase tracking-wide">Out</span>
              </button>
            ) : (
              <button onClick={() => gatewayService.disconnect()} className="p-1.5 hover:bg-white/5 rounded-lg text-white/15 hover:text-white/40 transition-colors" title="Disconnect">
                <Lock className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default Sidebar;
