
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  TASKS = 'TASKS',
  PROJECTS = 'PROJECTS',
  SCRAPBOOK = 'SCRAPBOOK',
  CALENDAR = 'CALENDAR',
  DOCUMENTS = 'DOCUMENTS',
  CONTRACTS = 'CONTRACTS',
  LICENSES = 'LICENSES',
  ACCOUNTING = 'ACCOUNTING',
  PAYROLL = 'PAYROLL',
  ASSETS = 'ASSETS',
  FLEET = 'FLEET',
  SKILLS = 'SKILLS',
  SETTINGS = 'SETTINGS',
  SECRETS = 'SECRETS',
  TERMINAL = 'TERMINAL',
  STRATEGY_SANDBOX = 'STRATEGY_SANDBOX',
  COMPLIANCE = 'COMPLIANCE',
  MISSION_LOG = 'MISSION_LOG',
  ECONOMY = 'ECONOMY',
  LIVE_BROWSER = 'LIVE_BROWSER',
  QUESTIONS = 'QUESTIONS',
  NEURAL = 'NEURAL',
  ADDRESS_BOOK = 'ADDRESS_BOOK',
  EMAIL = 'EMAIL',
  AGENTS = 'AGENTS',
  KNOWLEDGE = 'KNOWLEDGE',
  VPS_SETUP = 'VPS_SETUP',
  IMAGE_GEN = 'IMAGE_GEN',
  SOLANA_TRADER = 'SOLANA_TRADER',
}

export interface Question {
  id: string;
  text: string;
  category: 'FINANCE' | 'PROCESS' | 'LEGAL' | 'FLEET' | 'STRATEGY';
  status: 'PENDING' | 'LEARNED';
  answer?: string;
  timestamp: string;
}

export interface NavigationItem {
  view: AppView;
  label: string;
  order: number;
  isHidden?: boolean;
  children?: NavigationItem[];
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
}

export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  assignedTo?: string;
  tags: string[];
  projectId?: string;
  emoji?: string;
  color?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: boolean;
  startDate: string;
  tags: string[];
  emoji?: string;
  color?: string;
}

export interface Note {
  id: string;
  content: string;
  timestamp: string;
  tags: string[];
  emoji?: string;
  color?: string;
}

export interface Document {
  id: string;
  name: string;
  type: 'CONTRACT' | 'LICENSE' | 'INVOICE' | 'REPORT' | 'IMAGE' | 'GIF' | 'MEDIA' | 'OTHER' | 'PROTOCOL';
  status: 'ACTIVE' | 'EXPIRED' | 'DRAFT' | 'PENDING' | 'TRASHED';
  category?: 'LEGAL' | 'INSURANCE' | 'OPERATIONS' | 'LICENSES' | 'HERITAGE' | 'TAXES' | 'CRYPTO' | 'PAYROLL' | 'EXPENSES';
  expiryDate?: string;
  content?: string;
  lastModified: string;
  size?: string;
  previewUrl?: string;
  cost?: number;
  billingCycle?: 'MONTHLY' | 'YEARLY' | 'ONE_TIME';
  termLength?: string;
  emoji?: string;
  color?: string;
  concepts?: string[];
}

export interface Asset {
  id: string;
  name: string;
  description: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue: number;
  depreciationMethod: 'STRAIGHT_LINE' | 'MACRS';
  usefulLifeYears: number;
  category: 'VEHICLE' | 'MACHINERY' | 'EQUIPMENT' | 'PROPERTY';
  serialNumber?: string;
  lastServiceDate?: string;
  registrationExpiry?: string;
  smogCheckDue?: string;
  oilChangeDueMileage?: number;
  currentMileage?: number;
  emoji?: string;
  color?: string;
}

export interface License {
  id: string;
  name: string;
  type: 'INSURANCE' | 'LICENSE' | 'PERMIT';
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING';
  expiryDate: string;
  lastModified: string;
  cost: number;
  billingCycle: 'MONTHLY' | 'YEARLY';
  provider: string;
}

export interface ClientProject {
  id: string;
  name: string;
  date: string;
  description: string;
  beforeImage?: string;
  afterImage?: string;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  company: string;
  type: 'CLIENT' | 'PARTNER' | 'VENDOR' | 'EMPLOYEE';
  tier: 'STANDARD' | 'GOLD_STAR' | 'FIVE_STAR_BALLER';
  email: string;
  phone?: string;
  notes?: string;
  lastContacted?: string; // Date string
  lastWorked?: string; // Date string
  dossier?: string;
  reminders?: string[];
  projects?: ClientProject[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  type: 'MEETING' | 'DEADLINE' | 'REMINDER' | 'PAYMENT' | 'PAYROLL';
  description?: string;
  color?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: Date;
  isThinking?: boolean;
}

export interface PendingApproval {
  id: string;
  type: 'DELETION' | 'EMAIL' | 'BROWSER_TAKEOVER' | 'ASSET_COMMIT' | 'BROWSER_ACTION';
  title: string;
  description: string;
  action: () => void;
  onCancel: () => void;
}

export type ThinkingDepth = 'LOW' | 'MEDIUM' | 'HIGH';
export type DeliveryChannel = 'WEB' | 'SLACK' | 'SMS';
export type AgentPersona = 'OPS' | 'SUPPORT' | 'CREATIVE';

export interface AgentOptions {
  thinking: ThinkingDepth;
  channel: DeliveryChannel;
  sessionId: string;
  agentId: AgentPersona;
}

export type GatewayStatus = 'DISCONNECTED' | 'DISCOVERING' | 'CONNECTED' | 'AUTH_REQUIRED' | 'AUTH_FAILED';

export type AISoul = PersonaType;

export type PersonaType = 'assistant' | 'trader' | 'business' | 'claw';

export interface StyleConfig {
  glassmorphism: boolean;
  animations: boolean;
  glowEffects: boolean;
  roundedCorners: boolean;
}

export interface ShellConfig {
  shellName: string;
  persona: PersonaType;
  accentColor: string;    // HSL: "346 77% 50%"
  surfaceColor: string;   // HSL: "222 47% 11%"
  glowColor: string;      // HSL: "346 77% 50%"
  styles: StyleConfig;
  visibleViews: AppView[];
}

export interface PersonaPreset {
  id: PersonaType;
  label: string;
  icon: string;
  description: string;
  accentColor: string;
  surfaceColor: string;
  glowColor: string;
  visibleViews: AppView[];
  soulPrompt: string;
  navLabelOverrides?: Partial<Record<AppView, string>>;
}

export interface SoulMemory {
  learnings: string[];
  evolutionLevel: number;
  interactionCount: number;
}

export interface UserIdentity {
  name: string;
  role: string;
  company: string;
  soul: AISoul;
  accessKey: string;
  soulMemories: Record<AISoul, SoulMemory>;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  calls: number;
}

export interface UsageStats {
  totalCost: number;
  totalTokens: number;
  byModel: Record<string, ModelUsage>;
}

export interface UsageEntry {
  timestamp: string;   // ISO date string
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface ActivityLog {
  type: 'BROWSING' | 'TERMINAL' | 'THINKING' | 'SCANNING' | 'IDLE';
  message: string;
  timestamp: Date;
  meta?: any;
}

export interface SystemAlert {
  id: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  timestamp: Date;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  type: 'BUNDLED' | 'WORKSPACE' | 'MANAGED';
  status: 'ACTIVE' | 'SIMULATED' | 'MISSING_REQ' | 'AVAILABLE' | 'OFFLINE';
  icon: string;
  requirements: string[];
  category: 'COMMUNICATION' | 'FINANCE' | 'LEGAL' | 'PRODUCTIVITY' | 'SYSTEM';
  isEnabled: boolean;
}

export interface CronJob {
  id: string;
  name: string;
  command: string;
  schedule: string;
  lastRun: string | null;
  nextRun: string;
  status: 'ACTIVE' | 'PAUSED' | 'FAILED';
  channel: 'silent' | 'web';
}

export interface DoctorReport {
  timestamp: string;
  system: { status: string; uptime: string; version: string };
  network: { status: string; latency: string; gateway: string };
  skills: Array<{ name: string; status: string; health: string }>;
  security: { keys_found: string[]; keys_missing: string[]; encryption: string };
}

export interface GatewayConfig {
  host: string;
  token: string;
}

export interface TelemetryState {
  isActive: boolean;
  isVisualActive: boolean;
  url: string;
  title: string;
  lastAction: string;
  snapshot: string;
  screenshot: string;
  status: 'IDLE' | 'NAVIGATING' | 'SCRAPING' | 'WAITING_FOR_OPERATOR' | 'ROAMING';
  visualStream?: MediaStream | null;
  thoughts: Array<{ message: string; timestamp: Date; type: 'NAV' | 'ACTION' | 'THINKING' | 'DOWNLOAD' }>;
}

export type AgentStatus = 'IDLE' | 'ON_MISSION' | 'COMPLETE' | 'RETIRED';

export interface AgentChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface ClawAgent {
  id: string;
  name: string;
  mascot: string;
  quest: string;
  status: AgentStatus;
  specialty: string;
  color: string;
  createdAt: string;
  lastDirective?: string;
  chatHistory?: AgentChatMessage[];
  modelId?: string; // OpenRouter model ID — undefined = Gemini default
}

export type ExpenseCategory = 'GAS' | 'SUPPLIES' | 'MEALS' | 'TRAVEL' | 'SUBSCRIPTIONS' | 'MAINTENANCE' | 'INSURANCE' | 'OTHER';

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  vendor: string;
  note: string;
  date: string;
  emoji?: string;
}

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface Checklist {
  id: string;
  title: string;
  category: string;
  items: ChecklistItem[];
  createdAt: string;
  emoji?: string;
}
