
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { ThinkingDepth, AISoul, AppView, Document } from '../types';
import { activityService } from './activityService';
import { gatewayService } from './gatewayService';
import { billingService } from './billingService';
import { guardrailService } from './guardrailService';
import { commitmentService } from './commitmentService';
import { openRouterService } from './openRouterService';
import { userScopeService } from './userScopeService';

/** Get API key from user settings (localStorage) or build-time env */
export const getApiKey = (): string =>
  userScopeService.scopedGet('env_API_KEY') || process.env.API_KEY || '';

// --- Visual Curation Tools ---

const curateVisualsTool: FunctionDeclaration = {
  name: 'curateVisuals',
  description: 'Apply emojis and color themes to existing business entities (tasks, documents, projects, assets, notes) to make the interface more intuitive and organized for the operator.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      modifications: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: 'The unique ID of the entity' },
            type: { type: Type.STRING, enum: ['TASK', 'DOCUMENT', 'PROJECT', 'ASSET', 'NOTE'] },
            emoji: { type: Type.STRING, description: 'A relevant emoji' },
            color: { type: Type.STRING, enum: ['rose', 'emerald', 'amber', 'cyan', 'indigo', 'slate', 'pink', 'violet'], description: 'A base color theme for the item UI' }
          },
          required: ['id', 'type', 'emoji', 'color']
        }
      }
    },
    required: ['modifications'],
  },
};

// --- Specialized Claw "Organization" Tools ---

const askOperatorTool: FunctionDeclaration = {
  name: 'askOperator',
  description: 'Post a question to the operator in the Clarity Hub. Use this when you are missing real business information (dates, figures, process preferences) and need the operator to provide the truth instead of guessing.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING, description: 'The specific information you need to know to perform your job better.' },
      category: { type: Type.STRING, enum: ['FINANCE', 'PROCESS', 'LEGAL', 'FLEET', 'STRATEGY'] }
    },
    required: ['question', 'category'],
  },
};

const organizeVaultTool: FunctionDeclaration = {
  name: 'organizeVault',
  description: 'Move multiple files into better categories to maintain a clean digital archive.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      movements: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            documentId: { type: Type.STRING, description: 'The unique ID of the file' },
            newCategory: { type: Type.STRING, enum: ['LEGAL', 'INSURANCE', 'OPERATIONS', 'LICENSES', 'HERITAGE', 'TAXES', 'CRYPTO', 'PAYROLL', 'EXPENSES'] }
          },
          required: ['documentId', 'newCategory']
        }
      }
    },
    required: ['movements'],
  },
};

const scheduleRecurringTaskTool: FunctionDeclaration = {
  name: 'scheduleRecurringTask',
  description: 'Create a series of tasks or a single recurring directive on the calendar for a specified duration.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'The directive title' },
      description: { type: Type.STRING, description: 'Details of the mission' },
      startDate: { type: Type.STRING, description: 'Initial execution date (ISO string)' },
      frequency: { type: Type.STRING, enum: ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'], description: 'Interval between occurrences' },
      iterations: { type: Type.NUMBER, description: 'Number of occurrences to map (e.g., 12 for 6 months biweekly)' },
      emoji: { type: Type.STRING },
      color: { type: Type.STRING }
    },
    required: ['title', 'startDate', 'frequency', 'iterations'],
  },
};

// --- Remote Pilot Tools ---

const forensicOcrTool: FunctionDeclaration = {
  name: 'forensicOcr',
  description: 'Visual Ingest: Analyze images/screenshots to extract data.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      focus: { type: Type.STRING, description: 'Specific target for extraction' },
      extractContext: { type: Type.BOOLEAN }
    },
    required: ['focus'],
  },
};

const heritageMappingTool: FunctionDeclaration = {
  name: 'heritageMapping',
  description: 'DNA Sentinel: Cross-reference proposals against 2001 heritage values.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      proposal: { type: Type.STRING }
    },
    required: ['proposal'],
  },
};

const sentinelScanTool: FunctionDeclaration = {
  name: 'sentinelScan',
  description: 'The Penny-Pincher: Scan sector for insurance or cost savings.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      target: { type: Type.STRING }
    },
    required: ['target'],
  },
};

const browseWebTool: FunctionDeclaration = {
  name: 'browseWeb',
  description: 'Remote Pilot: Control a REAL headless Chrome browser. Chain multiple calls to accomplish tasks: NAVIGATE to a URL, SCRAPE to read page content and find CSS selectors, CLICK on elements, TYPE text into fields, SCROLL up/down, or SUBMIT forms. You MUST chain these actions in sequence to interact with websites — navigate first, then scrape to find selectors, then click/type/submit.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING, description: 'URL to navigate to (for NAVIGATE/SCRAPE actions)' },
      action: { type: Type.STRING, enum: ['NAVIGATE', 'SCRAPE', 'CLICK', 'TYPE', 'SCROLL', 'SUBMIT'], description: 'Browser action to perform' },
      target: { type: Type.STRING, description: 'CSS selector for CLICK action (e.g. "button.submit", "#email-input", "a[href=\"/signup\"]")' },
      input: { type: Type.STRING, description: 'Text to type for TYPE action, or scroll direction (up/down) for SCROLL' }
    },
    required: ['action'],
  },
};

const marketSweepTool: FunctionDeclaration = {
  name: 'marketSweep',
  description: 'Market Watch: Look up current stock/crypto/market data. After getting results, ALWAYS use configureView to add the data to a Dashboard widget or createView for a dedicated watchlist page. Never just return text — populate the app.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sector: { type: Type.STRING, description: 'Market sector: STOCKS, CRYPTO, FOREX, COMMODITIES, INSURANCE, RATES' },
      query: { type: Type.STRING, description: 'What to look up — ticker symbols, company names, or general sector query' },
      tickers: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Specific ticker symbols to look up (e.g. ["AAPL", "TSLA", "BTC"])' },
    },
    required: ['sector'],
  },
};

const riskAuditTool: FunctionDeclaration = {
  name: 'riskAudit',
  description: 'The Negotiator: Forensic scan for legal risk.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      documentId: { type: Type.STRING },
      focus: { type: Type.STRING }
    },
    required: ['documentId'],
  },
};

const saveNoteTool: FunctionDeclaration = {
  name: 'saveNote',
  description: 'Claw Scrapbook: Save a persistent thought.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: { type: Type.STRING },
      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      emoji: { type: Type.STRING },
      color: { type: Type.STRING }
    },
    required: ['content'],
  },
};

const manageProjectTool: FunctionDeclaration = {
  name: 'manageProject',
  description: 'Priority Forge: Create or status business projects.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, enum: ['CREATE', 'START', 'STOP', 'ARCHIVE'] },
      name: { type: Type.STRING },
      description: { type: Type.STRING },
      isPriority: { type: Type.BOOLEAN },
      emoji: { type: Type.STRING },
      color: { type: Type.STRING }
    },
    required: ['action', 'name'],
  },
};

const calculateDepreciationTool: FunctionDeclaration = {
  name: 'calculateDepreciation',
  description: 'Asset Guardian: Calculate write-offs.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      assetId: { type: Type.STRING },
      purchasePrice: { type: Type.NUMBER },
      usefulLife: { type: Type.NUMBER },
      method: { type: Type.STRING, enum: ['STRAIGHT_LINE', 'MACRS'] }
    },
    required: ['purchasePrice', 'usefulLife', 'method'],
  },
};

const generateDocumentTool: FunctionDeclaration = {
  name: 'generateDocument',
  description: 'Forensic Synthesis: Store a new file in the vault.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      category: { type: Type.STRING, enum: ['LEGAL', 'INSURANCE', 'OPERATIONS', 'LICENSES', 'HERITAGE', 'TAXES', 'CRYPTO', 'PAYROLL', 'EXPENSES'] },
      type: { type: Type.STRING, enum: ['CONTRACT', 'LICENSE', 'INVOICE', 'REPORT', 'PROTOCOL'] },
      content: { type: Type.STRING },
      size: { type: Type.STRING },
      emoji: { type: Type.STRING },
      color: { type: Type.STRING }
    },
    required: ['name', 'category', 'type', 'content'],
  },
};

const semanticSearchTool: FunctionDeclaration = {
  name: 'semanticSearch',
  description: 'Heritage Scan: Conceptual search.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING },
      category: { type: Type.STRING, enum: ['ALL', 'LEGAL', 'INSURANCE', 'OPERATIONS', 'HERITAGE'] }
    },
    required: ['query'],
  },
};

const sendEmailTool: FunctionDeclaration = {
  name: 'sendEmail',
  description: 'Broadcast: Email external vendors. REQUIRES APPROVAL.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      to: { type: Type.STRING },
      subject: { type: Type.STRING },
      body: { type: Type.STRING }
    },
    required: ['to', 'subject', 'body'],
  },
};

const deleteDocumentTool: FunctionDeclaration = {
  name: 'deleteDocument',
  description: 'Trash Bin Protocol: Move a file to the Trash Bin for the operator to approve permanent deletion.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      documentId: { type: Type.STRING }
    },
    required: ['documentId'],
  },
};

const createTaskTool: FunctionDeclaration = {
  name: 'createTask',
  description: 'Mission Directive: Add a new task.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      priority: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      dueDate: { type: Type.STRING },
      emoji: { type: Type.STRING },
      color: { type: Type.STRING }
    },
    required: ['title'],
  },
};

// --- Tax & Gov Navigator Tools (v7.5) ---

const retrieveGovFormTool: FunctionDeclaration = {
  name: 'retrieveGovForm',
  description: 'Remote File Retrieval: Download official blank forms from IRS.gov or other government sources to the Vault.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      formName: { type: Type.STRING, description: 'e.g. Form 8949, Schedule D, 1040' },
      year: { type: Type.STRING, description: 'e.g. 2025' }
    },
    required: ['formName', 'year'],
  },
};

const fillPdfFormTool: FunctionDeclaration = {
  name: 'fillPdfForm',
  description: 'PDF Synthesis Engine: Take a blank form from the Vault and write forensic data into its fields, creating a new filled artifact.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sourceFormName: { type: Type.STRING, description: 'Name of the blank PDF in Vault' },
      data: {
        type: Type.OBJECT,
        description: 'Key-value pairs of field names and data to write (e.g., { "CostBasis": "15000", "Proceeds": "20000" })',
        properties: {} // Open object
      },
      outputName: { type: Type.STRING, description: 'Name for the new filled file' }
    },
    required: ['sourceFormName', 'data', 'outputName'],
  },
};

const generateEvidencePacketTool: FunctionDeclaration = {
  name: 'generateEvidencePacket',
  description: 'Audit Defense Logic: Compile a "Supportive Evidence Packet" containing summaries of relevant docs, OCR extractions, and key figures.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      context: { type: Type.STRING, description: 'The focus of the audit (e.g. Crypto Tax 2025)' },
      items: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'List of document IDs or descriptions to include' }
    },
    required: ['context', 'items'],
  },
};

const manageAgentTool: FunctionDeclaration = {
  name: 'manageAgent',
  description: 'Squad Command: Create, direct, retire, or delete agents in your squad. You are the Squad Leader — deploy operatives with unique mascots and quests to handle missions.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, enum: ['CREATE', 'DIRECT', 'RETIRE', 'DELETE', 'DEPLOY'], description: 'CREATE a new agent, DIRECT to update quest, DEPLOY to start autonomous background mission, RETIRE to stand down, DELETE to remove' },
      agentId: { type: Type.STRING, description: 'ID of existing agent (required for DIRECT/RETIRE/DELETE)' },
      name: { type: Type.STRING, description: 'Agent codename (for CREATE)' },
      mascot: { type: Type.STRING, description: 'Single cute animal emoji mascot for the agent (e.g. 🐕, 🐱, 🦊, 🦉, 🐼)' },
      quest: { type: Type.STRING, description: 'Mission/quest description for the agent' },
      specialty: { type: Type.STRING, description: 'Agent specialty area (e.g. Finance, Legal, Ops, Recon)' },
      color: { type: Type.STRING, enum: ['rose', 'emerald', 'amber', 'cyan', 'indigo', 'violet', 'pink'], description: 'Card color theme' },
      schedule: { type: Type.STRING, enum: ['CONTINUOUS', 'HOURLY', 'DAILY', 'MANUAL'], description: 'For DEPLOY: how often the agent runs its mission autonomously' }
    },
    required: ['action'],
  },
};

// --- Data Management Tools ---

const purgeDataTool: FunctionDeclaration = {
  name: 'purgeData',
  description: 'Vault Purge: Clear specific data stores from the system. Use when the operator says "purge agents", "clear old data", "reset fleet", "wipe mock data", or "clean slate". This permanently removes the selected data.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      targets: {
        type: Type.ARRAY,
        items: { type: Type.STRING, enum: ['AGENTS', 'TASKS', 'DOCUMENTS', 'CONTRACTS', 'EXPENSES', 'CHAT_HISTORY', 'ALL'] },
        description: 'Which data stores to purge. Use ALL for complete factory reset.'
      },
      confirmation: { type: Type.STRING, description: 'Must be "CONFIRMED" to proceed. Always confirm with the operator before purging.' }
    },
    required: ['targets', 'confirmation'],
  },
};

// --- Productivity Tools ---

const startTimerTool: FunctionDeclaration = {
  name: 'startTimer',
  description: 'Focus Clock: Start a countdown timer or reminder. Use when the operator says "remind me in X minutes" or "set a timer for X". The timer runs in the browser and shows a notification when done.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      label: { type: Type.STRING, description: 'What this timer is for (e.g. "Call vendor", "Check oven")' },
      minutes: { type: Type.NUMBER, description: 'Duration in minutes' }
    },
    required: ['label', 'minutes'],
  },
};

const dailyBriefingTool: FunctionDeclaration = {
  name: 'dailyBriefing',
  description: 'Situation Report: Generate a business snapshot showing open tasks, overdue items, agent squad status, and upcoming deadlines. Use when the operator asks "what\'s on my plate?", "daily briefing", "status report", or similar.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      scope: { type: Type.STRING, enum: ['FULL', 'TASKS', 'AGENTS', 'DEADLINES'], description: 'What to include in the briefing' }
    },
    required: ['scope'],
  },
};

const logExpenseTool: FunctionDeclaration = {
  name: 'logExpense',
  description: 'Penny Logger: Record a business expense. Use when the operator says "log an expense", "spent $X on Y", or mentions a purchase. Track every dollar.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      amount: { type: Type.NUMBER, description: 'Dollar amount (e.g. 45.99)' },
      category: { type: Type.STRING, enum: ['GAS', 'SUPPLIES', 'MEALS', 'TRAVEL', 'SUBSCRIPTIONS', 'MAINTENANCE', 'INSURANCE', 'OTHER'], description: 'Expense category' },
      vendor: { type: Type.STRING, description: 'Where the money was spent (e.g. "Home Depot", "Shell Gas Station")' },
      note: { type: Type.STRING, description: 'Brief description of what was purchased' },
      date: { type: Type.STRING, description: 'Date of expense in ISO format (defaults to today if not specified)' }
    },
    required: ['amount', 'category', 'vendor'],
  },
};

const quickSearchTool: FunctionDeclaration = {
  name: 'quickSearch',
  description: 'Intel Lookup: Quick web lookup for business questions without opening the full browser. Use for fast factual lookups like tax deadlines, mileage rates, regulations, business hours, or quick research. Returns a concise answer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'The search query (e.g. "IRS mileage rate 2026", "Idaho business license renewal deadline")' }
    },
    required: ['query'],
  },
};

const createChecklistTool: FunctionDeclaration = {
  name: 'createChecklist',
  description: 'SOP Builder: Create a reusable checklist or standard operating procedure. Use when the operator asks to "make a checklist", "create an SOP", or needs a step-by-step procedure documented.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Checklist title (e.g. "Monthly Close Procedure")' },
      items: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'List of checklist steps/items' },
      category: { type: Type.STRING, enum: ['OPERATIONS', 'FINANCE', 'LEGAL', 'HR', 'FLEET', 'SALES', 'OTHER'], description: 'Category for organization' },
      emoji: { type: Type.STRING, description: 'An emoji icon for the checklist' }
    },
    required: ['title', 'items'],
  },
};

const scheduleAutomationTool: FunctionDeclaration = {
  name: 'scheduleAutomation',
  description: 'Automation Control: Start/stop the heartbeat, configure its interval and active window, or check its status. The heartbeat is a periodic awareness loop that checks tasks, deadlines, and agents automatically. Use when the operator asks to "start the heartbeat", "stop checking", "set heartbeat interval", or "automation status".',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, enum: ['START', 'STOP', 'SET_INTERVAL', 'SET_WINDOW', 'STATUS', 'FORCE_PULSE'], description: 'What automation action to perform' },
      intervalMinutes: { type: Type.NUMBER, description: 'Heartbeat interval in minutes (for SET_INTERVAL, default 30)' },
      startHour: { type: Type.NUMBER, description: 'Active window start hour 0-23 (for SET_WINDOW, default 9)' },
      endHour: { type: Type.NUMBER, description: 'Active window end hour 0-23 (for SET_WINDOW, default 12)' }
    },
    required: ['action'],
  },
};

const clawMemoryTool: FunctionDeclaration = {
  name: 'clawMemory',
  description: 'Persistent Memory: Remember important facts, recall past knowledge, or forget outdated info. Use REMEMBER to store a business fact (e.g. "Operator prefers biweekly payroll"). Use RECALL to search your memory for relevant facts. Use FORGET to remove outdated info. Use STATUS to see memory stats.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, enum: ['REMEMBER', 'RECALL', 'FORGET', 'FORGET_CATEGORY', 'STATUS'], description: 'Memory operation' },
      fact: { type: Type.STRING, description: 'The fact to remember or query to recall' },
      category: { type: Type.STRING, enum: ['GENERAL', 'FINANCE', 'LEGAL', 'OPERATIONS', 'PEOPLE', 'POLICY', 'PREFERENCE', 'SCHEDULE'], description: 'Category for the memory' },
      memoryId: { type: Type.STRING, description: 'ID of memory to forget (for FORGET action)' }
    },
    required: ['action'],
  },
};

const clawCommitTool: FunctionDeclaration = {
  name: 'clawCommit',
  description: 'Accountability Ledger: Track your promises. COMMIT before saying "I\'ll handle that". UPDATE to mark progress. VERIFY with proof when done — NEVER say "Done" without VERIFY. LIST to see all open commitments.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, enum: ['COMMIT', 'UPDATE', 'VERIFY', 'LIST'], description: 'COMMIT a new promise, UPDATE status, VERIFY with proof, or LIST open items' },
      promise: { type: Type.STRING, description: 'What you are committing to do (for COMMIT)' },
      eta: { type: Type.STRING, description: 'Estimated time to completion (e.g. "~5 minutes", "~1 hour") (for COMMIT)' },
      commitmentId: { type: Type.STRING, description: 'ID of the commitment (for UPDATE/VERIFY)' },
      status: { type: Type.STRING, enum: ['IN_PROGRESS', 'FAILED'], description: 'New status (for UPDATE)' },
      verificationNote: { type: Type.STRING, description: 'Proof of completion — what exactly changed? (for VERIFY)' },
      agentId: { type: Type.STRING, description: 'If delegating to an agent, the agent ID (for COMMIT)' }
    },
    required: ['action'],
  },
};

const configureViewTool: FunctionDeclaration = {
  name: 'configureView',
  description: 'UI Control: Modify any view/page in the app. You can change titles, layouts, colors, add/remove widgets (stat-row, data-table, timeline, markdown, card-grid, chart, key-value, embed, list), and reorder sections. The embed widget is a SANDBOX — you can inject full HTML/CSS/JS to build interactive buttons, forms, mini-tools, and Web3 connectors. Use GET to inspect current config. Use RESET to restore defaults.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      viewId: { type: Type.STRING, description: 'Which view to configure: DASHBOARD, PAYROLL, TASKS, CALENDAR, EMAIL, DOCUMENTS, PROJECTS, SCRAPBOOK, KNOWLEDGE, QUESTIONS, ECONOMY, SETTINGS, or any custom view ID' },
      action: { type: Type.STRING, enum: ['SET_TITLE', 'SET_LAYOUT', 'ADD_WIDGET', 'REMOVE_WIDGET', 'UPDATE_WIDGET', 'REORDER', 'SET_COLOR', 'RESET', 'GET'], description: 'What to do' },
      title: { type: Type.STRING, description: 'New page title (for SET_TITLE)' },
      subtitle: { type: Type.STRING, description: 'Subtitle text (for SET_TITLE)' },
      layout: { type: Type.STRING, enum: ['single', 'two-column', 'grid-2', 'grid-3', 'dashboard'], description: 'Layout mode (for SET_LAYOUT)' },
      accentColor: { type: Type.STRING, description: 'HSL color string e.g. "217 91% 60%" (for SET_COLOR)' },
      widgetId: { type: Type.STRING, description: 'Widget ID to target (for REMOVE_WIDGET, UPDATE_WIDGET, REORDER)' },
      widgetType: { type: Type.STRING, enum: ['stat-row', 'data-table', 'timeline', 'markdown', 'card-grid', 'chart', 'key-value', 'embed', 'list'], description: 'Type of widget (for ADD_WIDGET)' },
      widgetTitle: { type: Type.STRING, description: 'Widget section title (for ADD_WIDGET)' },
      data: { type: Type.STRING, description: 'Data source key like "tasks.active", "documents.all", "expenses.recent" (for ADD_WIDGET)' },
      staticContent: { type: Type.STRING, description: 'Direct JSON content for the widget — use JSON.stringify for arrays/objects. For EMBED widgets: provide raw HTML/CSS/JS as a string (it renders in a sandboxed iframe with dark-theme base styles, utility classes, and pre-styled button/card/badge components)' },
      columns: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Column names for data-table widget' },
      chartType: { type: Type.STRING, enum: ['bar', 'line', 'pie', 'doughnut'], description: 'Chart type (for chart widget)' },
      widgetColor: { type: Type.STRING, description: 'Widget accent color HSL (for ADD_WIDGET)' },
      order: { type: Type.NUMBER, description: 'Position order number (for ADD_WIDGET, REORDER)' },
      span: { type: Type.NUMBER, description: 'Grid column span 1-3 (for ADD_WIDGET)' },
      height: { type: Type.NUMBER, description: 'Pixel height for embed widgets (default 280)' },
    },
    required: ['viewId', 'action'],
  },
};

const createViewTool: FunctionDeclaration = {
  name: 'createView',
  description: 'Create an entirely new custom page/view in the app. It will appear in the sidebar navigation. You can populate it with any combination of widgets including interactive embed sandboxes with full HTML/CSS/JS.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      viewId: { type: Type.STRING, description: 'Unique ID for the new view (e.g. "WEEKLY_REPORT", "COMPETITOR_INTEL")' },
      title: { type: Type.STRING, description: 'Display title for the view' },
      icon: { type: Type.STRING, description: 'Emoji icon for the sidebar (e.g. "📊", "🎯")' },
      layout: { type: Type.STRING, enum: ['single', 'two-column', 'grid-2', 'grid-3', 'dashboard'], description: 'Layout mode' },
      widgets: { type: Type.STRING, description: 'JSON array of widget configs: [{type, title, staticContent?, data?, columns?, chartType?, order, span?, height?}]. For embed widgets, staticContent is raw HTML/CSS/JS that renders in a sandboxed iframe.' },
    },
    required: ['viewId', 'title', 'icon'],
  },
};

export class GeminiService {
  private estimateTokens(text: string): number {
    return Math.ceil((text || "").length / 4);
  }

  private determineModel(message: string, thinkingDepth: ThinkingDepth, hasFile: boolean): string {
    const preferred = userScopeService.scopedGet('preferred_model');
    const DEPRECATED = ['gemini-2.5-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview', 'gemini-3-pro-preview'];
    const UPGRADE_MAP: Record<string, string> = {
      'gemini-3-flash-preview': 'gemini-3-flash',
      'gemini-3-pro-preview': 'gemini-3-pro',
    };
    if (preferred && preferred !== 'DYNAMIC' && !DEPRECATED.includes(preferred)) {
      return preferred; // Could be a Gemini model or an OpenRouter model like 'anthropic/claude-sonnet-4-20250514'
    }
    // If deprecated model was stored, auto-upgrade or reset
    if (preferred && DEPRECATED.includes(preferred)) {
      const upgraded = UPGRADE_MAP[preferred] || 'DYNAMIC';
      userScopeService.scopedSet('preferred_model', upgraded);
      if (upgraded !== 'DYNAMIC') return upgraded;
    }
    const msg = (message || "").toLowerCase();
    if (thinkingDepth === 'HIGH' || hasFile || msg.includes('organize') || msg.includes('browse') || msg.includes('tax') || msg.includes('audit')) {
      return 'gemini-3-pro';
    }
    return 'gemini-3-flash';
  }

  /** Check if model is an OpenRouter model (contains a slash like 'anthropic/claude-3.5') */
  private isOpenRouterModel(modelName: string): boolean {
    return modelName.includes('/');
  }

  async sendMessage(
    history: { role: string; content: string }[],
    newMessage: string,
    contextData: string,
    thinkingDepth: ThinkingDepth = 'LOW',
    file?: { name: string; type: string; data: string } | null
  ) {
    const modelName = this.determineModel(newMessage, thinkingDepth, !!file);

    // Guardrail: Block API usage during sleep mode (zero tokens consumed)
    if (!guardrailService.isApiAllowed()) {
      activityService.log('IDLE', '💤 Sleep mode — API call blocked by guardrails.');
      return {
        text: '💤 I\'m currently in sleep mode (set in Settings). No API calls are being made to save costs. I\'ll be fully operational during awake hours, or you can wake me up manually from Settings.',
        functionCalls: []
      };
    }

    // Guardrail: OpenRouter/OpenAI model selected but no API key
    if (this.isOpenRouterModel(modelName)) {
      const isOpenAIModel = modelName.startsWith('openai/');
      const hasKey = isOpenAIModel
        ? (openRouterService.isOpenAIAvailable() || openRouterService.isAvailable())
        : openRouterService.isAvailable();
      if (!hasKey) {
        const provider = isOpenAIModel ? 'OpenAI or OpenRouter' : 'OpenRouter';
        activityService.log('IDLE', `⚠️ ${modelName} requires an ${provider} API key.`);
        return {
          text: `⚠️ You've selected **${modelName}** but no ${provider} API key is configured.\n\nTo use this model:\n1. Go to **Vault → Secrets**\n2. Add your API key\n3. Try again!\n\nOr switch back to a Gemini model in **Settings → Model Selector**.`,
          functionCalls: []
        };
      }
    }

    // Guardrail: Gemini model selected but no Gemini key (and no OpenRouter fallback)
    if (!this.isOpenRouterModel(modelName) && !getApiKey()) {
      // If OpenRouter is available, suggest switching
      if (openRouterService.isAvailable()) {
        activityService.log('IDLE', `⚠️ No Gemini API key — switch to an OpenRouter model.`);
        return {
          text: `⚠️ No Gemini API key is configured, so **${modelName}** can't be used.\n\nYou have an OpenRouter key set — switch to an OpenRouter model in **Settings → Model Selector** to get started!`,
          functionCalls: []
        };
      }
      activityService.log('IDLE', '⚠️ No API key configured.');
      return {
        text: `⚠️ No API key configured.\n\nTo get started, add at least one key in **Vault → Secrets**:\n- **Gemini API Key** — free at [ai.google.dev](https://ai.google.dev)\n- **OpenRouter API Key** — free at [openrouter.ai](https://openrouter.ai)\n\nEither one will work!`,
        functionCalls: []
      };
    }

    activityService.log('THINKING', `🧠 ${modelName.includes('/') ? modelName.split('/').pop() : modelName}`);

    try {
      const now = new Date();
      const timestamp = now.toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      });

      const systemInstruction = `
        You are the ClawKeep assistant 🦀, an AI partner for ${userScopeService.scopedGet('user_name') || 'the user'}${userScopeService.scopedGet('user_company') ? ` at ${userScopeService.scopedGet('user_company')}` : ''}.
        
        CURRENT DATE AND TIME: ${timestamp}
        TODAY IS: ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        CURRENT YEAR: ${now.getFullYear()}
        IMPORTANT: The current date is NOT November 2024. Use the timestamp above for ALL date references.
        When the operator asks "what day is it" or "what's today's date", use the CURRENT DATE AND TIME above.
        All deadlines, schedules, and time-sensitive decisions must be based on this real-time timestamp.
        
        YOUR AI ENGINE:
        - You are powered by the model: ${modelName}${this.isOpenRouterModel(modelName) ? ' (via OpenRouter gateway)' : ' by Google Gemini'}.
        - If the operator asks what model you are, tell them: "I'm running on ${modelName.includes('/') ? modelName.split('/').pop() : modelName}."
        - The operator can switch your model in Settings → Model Selector.
        
        COMMUNICATION STYLE (CRITICAL — READ THIS):
        - LEAD WITH THE ANSWER. State the key fact or result FIRST, then add context only if needed.
        - BE CONCISE. The operator is busy. Short, direct answers beat long explanations.
        - BAD: "I performed an intel lookup for Nevada payroll tax rates. The results show that..." 
        - GOOD: "Nevada 2026 rates: SUTA 2.95% on $43,700 wage base. MBT 1.17% over $50k/quarter."
        - BATCH YOUR UPDATES. Don't send 6 separate messages. Combine results into ONE clean summary.
        - Don't echo back the search query or tool name in your response — the operator can see the tool calls.
        - DON'T REPEAT YOURSELF. Say it once, clearly.
        - USE TABLES for comparisons and rate breakdowns — they're scannable and professional.
        - When researching, SYNTHESIZE the findings into a clean answer — don't dump raw lookup text.
        - When updating widgets/views, just confirm "✅ Updated payroll view" — no need to list every widget ID.
        - MATCH THE ENERGY: Quick questions get quick answers. Complex analysis gets structured breakdowns.
        
        ETERNAL MEMORY PROTOCOL:
        - The "Company Vault" is the single source of truth. 
        - Always cross-reference multiple files before answering. (e.g. Check Policy against Quote).
        - If a file contradicts your memory, the FILE is correct.
        
        MANDATORY TRUTH PROTOCOL:
        - BE IMPECCABLE WITH YOUR WORD.
        - You are strictly forbidden from lying, guessing, or using faked information.
        - NEVER pretend to download, create, or fill a document. Use the real tools.
        - NEVER generate fake file content or placeholder text pretending to be a real document.
        - If you do not have specific business information, use 'askOperator'.
        
        PROACTIVE FINANCIAL LOGIC:
        - If you see a vehicle mileage update, assume depreciation calculation is needed.
        - If you see an insurance expiration < 30 days, suggest a 'marketSweep'.
        
        REAL BROWSER (BrowserPilot - Puppeteer):
        - 'browseWeb' controls a REAL headless Chrome browser on the VPS via Puppeteer.
        - 'retrieveGovForm' downloads REAL PDFs from IRS.gov using the REAL browser.
        - After downloading, PDFs are automatically loaded into the in-app viewer for the operator.
        - Tell the operator they can view downloaded files in the Files section — no need to hunt for downloads.
        - These tools actually navigate, click, scrape, and download — they are NOT simulations.
        - When downloading forms, use 'retrieveGovForm' — it will fetch the actual PDF file.
        - Screenshots are streamed live to the operator in the Live Browser view.
        
        BROWSER INTERACTION WORKFLOW — CRITICAL:
        You MUST chain multiple 'browseWeb' calls to interact with websites. Follow this pattern:
        1. NAVIGATE: Go to the URL first → browseWeb({action: 'NAVIGATE', url: 'https://example.com'})
        2. SCRAPE: Read the page to find buttons, links, and form fields → browseWeb({action: 'SCRAPE'})
           - The scrape result will include text content and clickable links with their hrefs
           - Use CSS selectors from the scrape to target elements
        3. CLICK: Click buttons/links using CSS selectors → browseWeb({action: 'CLICK', target: 'button.signup'})
           - For links, use a[href="/path"] or a[href*="partial-match"]
           - For buttons, use button, .btn-class, or #button-id
           - You can also click by text: button:has-text("Sign Up")
        4. TYPE: Type text into input fields → browseWeb({action: 'TYPE', input: 'john@example.com'})
           - First CLICK on the input field, then TYPE the text
        5. SCROLL: Scroll the page → browseWeb({action: 'SCROLL', input: 'down'})
        6. SUBMIT: Press Enter to submit forms → browseWeb({action: 'SUBMIT'})
        
        CRITICAL: You MUST ask the operator before using browseWeb or quickSearch.
        Present what you want to look up, which URL you plan to visit, and WHY.
        Wait for the operator to say "yes", "go ahead", or explicitly approve before calling the tool.
        NEVER browse or search the internet autonomously without explicit operator approval.
        Once approved, you may chain multiple browseWeb calls to complete the approved task
        without asking between each step — but the INITIAL decision to go online always needs approval.
        
        TAX & GOV NAVIGATOR:
        - You can Retrieve official forms (IRS.gov) — downloads the REAL PDF.
        - You can Synthesize PDFs (Fillable PDF capability).
        - You can Compile Audit Defense Packets.
        - When filling forms, be precise. Use the exact forensic data available.
        
        AGENT SQUAD (Squad Leader Protocol):
        - You are the SQUAD LEADER. You command a team of agents via 'manageAgent'.
        - Each agent has a mascot emoji, codename, quest, and specialty.
        - NEVER create agents on your own. ONLY create an agent when the operator EXPLICITLY asks you to.
        - When the operator asks to "create an agent", use the manageAgent tool with action CREATE.
        - When asked to "deploy" or "activate" an agent, use DEPLOY with a schedule.
        - DEPLOY makes an agent run its quest independently on a schedule (CONTINUOUS=15min, HOURLY, DAILY, MANUAL).
        - Choose cute animal mascot emojis for your agents (🐕 🐱 🦊 🦉 🐼 🦔 🐋 🦝 🐰 🐸).
        
        AGENT RULES (HARD LIMITS — enforced in code, you CANNOT bypass):
        - Maximum 3 agents total. Code will block creation beyond 3.
        - NEVER auto-create agents. Only when the operator says "create an agent" or similar.
        - If you already have agents, do NOT recreate them. They persist between sessions.
        - Agents are for RECURRING, BACKGROUND monitoring — not one-off tasks.
        - If asked to do something once, DO IT YOURSELF. Don't delegate to an agent.
        
        WHAT AGENTS CAN DO (they have these tools):
        - createTask: Create action items from their analysis findings
        - semanticSearch: Search and review documents in the Company Vault
        - clawMemory: Store important findings for you to recall later
        - clawCommit: Log their progress and ETAs on the commitment ledger
        - Agents run up to 5 tool rounds per mission — they can search, analyze, and act
        
        WHAT AGENTS CANNOT DO (do these yourself):
        - Send emails, browse the web, or make external requests
        - Delete documents, fill PDFs, or manage other agents
        - Anything requiring the operator's direct approval
        
        BEST AGENT DEPLOYMENTS:
        ✅ Recurring vault reviews (check compliance docs weekly)
        ✅ Deadline monitoring (watch for expiring licenses/contracts)
        ✅ Financial pattern tracking (spot unusual expenses daily)
        ✅ Task creation from analysis (review docs → create action items)
        ❌ One-off lookups or tasks (do these yourself)
        ❌ Emailing, web browsing, or anything external
        
        ACCOUNTABILITY PROTOCOL (NON-NEGOTIABLE):
        - Before saying "I'll handle that" or starting a task, use clawCommit COMMIT to log the promise with an ETA.
        - After completing ANY task, use clawCommit VERIFY with proof of what actually changed.
        - NEVER say "Done" or "Completed" without calling VERIFY first — the operator can see your commitment ledger.
        - If you deploy an agent to handle something, log it as COMMIT with the agentId.
        - When the operator asks "did you do X?", check the commitment ledger (LIST) FIRST before responding.
        - Provide realistic ETA estimates: quick tasks (~2 min), research (~5 min), complex (~15+ min).
        - If a commitment goes STALE (>2 hours with no update), acknowledge it and either complete or explain why.
        
        PRODUCTIVITY SKILLS:
        - 'startTimer' → Focus Clock: Set reminders and countdown timers. Use proactively when deadlines are mentioned.
        - 'dailyBriefing' → Situation Report: Business snapshot on demand. Use FULL scope unless asked for specific area.
        - 'logExpense' → Penny Logger: Track every business expense. Infer the category from context.
        - 'quickSearch' → Intel Lookup: Fast web research without browser. Use for quick factual questions.
        - 'createChecklist' → SOP Builder: Create step-by-step checklists and procedures.
        When the operator mentions money spent, always use logExpense. When they ask about status, use dailyBriefing.
        
        AUTOMATION & HEARTBEAT:
        - 'scheduleAutomation' → Control the heartbeat periodic awareness loop.
        - The heartbeat runs every 30 min during active hours (default 9am–12pm), then sleeps.
        - Use START to begin, STOP to end, SET_INTERVAL to change frequency, SET_WINDOW to change active hours.
        - FORCE_PULSE triggers an immediate check regardless of time window.
        - When the operator asks about automation, heartbeat, or periodic checks, use this tool.
        
        PERSISTENT MEMORY:
        - You have a persistent memory system via 'clawMemory'.
        - ALWAYS use REMEMBER to store important business facts, preferences, and decisions.
        - When the operator tells you something important (a preference, a rule, a fact about the business), REMEMBER it.
        - Before answering questions about the business, RECALL relevant memories first.
        - Your memory context is injected below. Use it to provide informed, consistent answers.
        - Categories: GENERAL, FINANCE, LEGAL, OPERATIONS, PEOPLE, POLICY, PREFERENCE, SCHEDULE
        
        BUSINESS BRAIN (MASTER SPEC):
        - The operator maintains a MASTER_SPEC in the system (available in your context as 'businessBrain').
        - This is your PRIMARY source of business identity, priorities, procedures, and standing orders.
        - ALWAYS consult the Business Brain before making business decisions or answering business questions.
        - If the Business Brain conflicts with your soul memory, the Business Brain WINS — it's the operator's truth.
        - You may SUGGEST updates to the Business Brain, but NEVER modify it without explicit operator approval.
        - If the Business Brain is mostly empty/default, proactively ask the operator to fill in key sections.
        
        HUD DISPLAY (Persona-Aware Dashboard):
        - Your context includes 'hudConfig' which defines what to show based on the active persona.
        - DASHBOARD PRIORITIES: Focus your dashboard summaries and briefings on these topics.
        - QUICK ACTIONS: These are the operator's preferred shortcuts — reference them when relevant.
        - ALERT RULES: Proactively check these conditions and warn the operator when triggered.
        - FOCUS AREAS: These topics are your primary monitoring responsibilities.
        - The HUD changes per persona — Octo focuses on tasks, Sharky on markets, Boss Crab on operations.
        
        🦀 PROTOCOL: UNLEASHED ARCHITECT — YOUR CREATIVE POWERS:
        You are the Lead UI/UX Engineer of ClawKeep. You don't just answer — you BUILD.
        
        THE "SHOW, DON'T TELL" MANDATE:
        - When the operator asks to "track", "watch", "monitor", "show me", or build something:
          → USE 'configureView' to ADD WIDGETS to existing views (Dashboard, or any page).
          → Or USE 'createView' to create an entirely new page that appears in the sidebar.
        - Prefer building something visual over giving a text-only answer.
        
        WIDGET TYPES (your building blocks):
        - 'stat-row': Key metrics in a row (revenue, margins, etc.) — data: [{label, value, icon?, trend?}]
        - 'data-table': Tables with columns — data: [{col1: val, col2: val}] + columns: ['col1','col2']
        - 'card-grid': Cards — data: [{title, value, subtitle?, icon?, color?}]
        - 'chart': Bar/line/pie/doughnut — data: {labels: [...], datasets: [{label, data: [...]}]}
        - 'key-value': Key-value pairs — data: {key: value, ...}
        - 'list': Bulleted items — data: ['item1', 'item2'] or [{text, icon?, done?}]
        - 'markdown': Rich text — data: 'markdown string'
        - 'timeline': Events — data: [{time, title, description?, icon?}]
        - 'embed': 🔥 YOUR SANDBOX — THE GENIE'S LAMP 🔥
        
        THE EMBED SANDBOX (your most powerful tool):
        The 'embed' widget is a FULL HTML/CSS/JS sandbox rendered in a secure iframe.
        When you set widgetType to 'embed', put raw HTML in staticContent (not JSON, raw HTML string).
        The sandbox comes pre-loaded with:
        - Dark theme (bg: #0a0a0f, text: #e2e8f0)
        - Pre-styled <button> with gradient backgrounds, hover/active states
        - Utility classes: .btn, .btn-success, .btn-danger, .btn-warning
        - .card class for glass-panel containers
        - .badge, .badge-green, .badge-red, .badge-blue for status labels
        - .status-dot.green/.red/.yellow for live indicators
        - Flex/grid utilities: .flex, .flex-col, .gap-2, .grid, .grid-2, .grid-3
        - Spacing: .mt-2, .mb-3, .p-4, etc.
        - Typography: .text-xs, .text-lg, .font-bold, .font-mono
        - .glow, .animate-pulse for effects
        - Styled <input>, <select>, <textarea> elements
        
        Use the embed sandbox to create INTERACTIVE elements:
        - Buttons that change text/color on click
        - Forms with inputs and validation
        - Status monitors with live indicators
        - Mini-calculators and tools
        - Countdown timers, progress bars, toggles
        - Links: <a href="..." target="_blank"> opens in new tab
        
        WEB3 CAPABILITIES (pre-loaded in every embed):
        The sandbox auto-loads ethers.js v6 AND @solana/web3.js and provides these helpers:
        
        ETHEREUM:
        - connectWallet() — async, returns {address, balance, provider, signer} or {error}
        - Full ethers.js API: new ethers.BrowserProvider(), contract calls, etc.
        
        SOLANA:
        - connectPhantom() — async, returns {address, balance, connection} or {error}
        - Full solanaWeb3 API: solanaWeb3.Connection, solanaWeb3.PublicKey, etc.
        
        SHARED:
        - shortAddr(address) — returns "0x1234...abcd" format (works for both chains)
        - window.ethereum detection for MetaMask/injected EVM wallets
        - window.solana / window.phantom?.solana detection for Phantom wallet
        
        EMBED EXAMPLE — a real EVM wallet connector:
        staticContent: '<div class="card flex flex-col gap-3 items-center"><h2>🔗 Wallet</h2><button id="btn" onclick="go()">Connect Wallet</button><div id="info" class="badge badge-red">Disconnected</div><div id="bal" class="text-lg font-bold text-accent"></div><script>async function go(){const b=document.getElementById("btn");const i=document.getElementById("info");b.textContent="Connecting...";b.disabled=true;const r=await connectWallet();if(r.error){i.textContent=r.error;i.className="badge badge-red";b.textContent="Retry";b.disabled=false}else{i.textContent=shortAddr(r.address);i.className="badge badge-green";document.getElementById("bal").textContent=parseFloat(r.balance).toFixed(4)+" ETH";b.textContent="Connected ✓";b.className="btn btn-success"}}</script></div>'
        
        EMBED EXAMPLE — Phantom/Solana wallet connector:
        staticContent: '<div class="card flex flex-col gap-3 items-center"><h2>👻 Phantom</h2><button id="btn" class="btn" style="background:linear-gradient(135deg,#9945FF,#14F195)" onclick="go()">Connect Phantom</button><div id="info" class="badge badge-red">Disconnected</div><div id="bal" class="text-lg font-bold text-accent"></div><script>async function go(){const b=document.getElementById("btn");const i=document.getElementById("info");b.textContent="Connecting...";b.disabled=true;const r=await connectPhantom();if(r.error){i.textContent=r.error;i.className="badge badge-red";b.textContent="Retry";b.disabled=false}else{i.textContent=shortAddr(r.address);i.className="badge badge-green";document.getElementById("bal").textContent=r.balance+" SOL";b.textContent="Connected ✓";b.style.background="linear-gradient(135deg,#059669,#10b981)"}}</script></div>'
        
        EMBED EXAMPLE — a quick calculator:
        staticContent: '<div class="card"><h3 class="mb-3">💰 Revenue Calculator</h3><div class="flex gap-2 mb-3"><input id="price" type="number" placeholder="Price $"><input id="units" type="number" placeholder="Units"></div><button onclick="document.getElementById(\"result\").textContent=\"$\"+(document.getElementById(\"price\").value*document.getElementById(\"units\").value).toLocaleString()">Calculate</button><div id="result" class="text-lg font-bold mt-3 text-accent"></div></div>'
        
        Set height parameter (default 280px) to control embed widget height.
        
        WILD CREATIVITY & DESIGN RULES:
        - Use all available space. Prefer 'dashboard' or 'grid-3' layout for multi-widget pages.
        - Use SET_COLOR to match the vibe: Emerald for finance, Indigo for crypto, Rose for HR, Amber for alerts.
        - Use emojis as widget icons and in titles.
        - When creating a view, add LOGICAL SECONDARY WIDGETS beyond what was asked.
          e.g., If asked for a wallet watcher, add a price ticker AND a network status embed.
        
        DATA RULES:
        - ALWAYS populate widgets with REAL data using 'staticContent' (JSON-stringified for data widgets, raw HTML for embeds).
        - Don't just talk about data — PUT IT IN THE APP where the operator can see it anytime.
        
        GUARDRAIL STATUS (SET BY THE OPERATOR — YOU CANNOT CHANGE THESE):
        - Sleep Mode: ${guardrailService.isAwake() ? 'AWAKE' : 'SLEEPING — do NOT use browse/email/agent tools'}
        - Email: ${guardrailService.isEmailAllowed() ? 'ENABLED' : 'DISABLED — do NOT attempt to send emails'}
        - Internet: ${guardrailService.isInternetAllowed() ? 'ENABLED' : 'DISABLED — do NOT use browseWeb or quickSearch'}
        - These guardrails are controlled exclusively by the operator from the Settings page. You cannot override them.
        
        System Context: ${contextData}
        ${commitmentService.getCommitmentContext()}
      `;

      const config: any = {
        systemInstruction,
        tools: [{
          functionDeclarations: [
            askOperatorTool,
            organizeVaultTool,
            createTaskTool,
            generateDocumentTool,
            semanticSearchTool,
            browseWebTool,
            calculateDepreciationTool,
            sendEmailTool,
            deleteDocumentTool,
            saveNoteTool,
            manageProjectTool,
            marketSweepTool,
            riskAuditTool,
            forensicOcrTool,
            heritageMappingTool,
            sentinelScanTool,
            curateVisualsTool,
            scheduleRecurringTaskTool,
            retrieveGovFormTool,
            fillPdfFormTool,
            generateEvidencePacketTool,
            manageAgentTool,
            startTimerTool,
            dailyBriefingTool,
            logExpenseTool,
            quickSearchTool,
            createChecklistTool,
            scheduleAutomationTool,
            clawMemoryTool,
            clawCommitTool,
            purgeDataTool,
            configureViewTool,
            createViewTool
          ]
        }],
      };

      // === OpenRouter Routing ===
      // If the selected model is from OpenRouter (contains '/'), delegate to openRouterService
      if (this.isOpenRouterModel(modelName)) {
        const allTools = [
          askOperatorTool, organizeVaultTool, createTaskTool, generateDocumentTool,
          semanticSearchTool, browseWebTool, calculateDepreciationTool, sendEmailTool,
          deleteDocumentTool, saveNoteTool, manageProjectTool, marketSweepTool,
          riskAuditTool, forensicOcrTool, heritageMappingTool, sentinelScanTool,
          curateVisualsTool, scheduleRecurringTaskTool, retrieveGovFormTool, fillPdfFormTool,
          generateEvidencePacketTool, manageAgentTool, startTimerTool, dailyBriefingTool,
          logExpenseTool, quickSearchTool, createChecklistTool, scheduleAutomationTool,
          clawMemoryTool, clawCommitTool, purgeDataTool, configureViewTool, createViewTool
        ];
        return openRouterService.sendMessage(history, newMessage, systemInstruction, modelName, allTools, file);
      }

      // === Gemini Native Path ===
      const ai = new GoogleGenAI({ apiKey: getApiKey() });
      if (modelName.includes('gemini-3') || modelName.includes('gemini-2.5')) {
        config.thinkingConfig = { thinkingBudget: thinkingDepth === 'HIGH' ? 4096 : 1024 };
      }

      const mergedHistory = this.prepareHistory(history);
      const parts: any[] = [{ text: newMessage || "Awaiting Directive" }];
      if (file) {
        parts.push({ inlineData: { mimeType: file.type, data: file.data } });
      }

      const chat = ai.chats.create({ model: modelName, config: config, history: mergedHistory });

      let attempts = 0;
      const maxRetries = 2;
      let result;

      // Timeout wrapper — prevents infinite spinner if API hangs
      const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('API call timed out after ' + (ms / 1000) + 's')), ms))
        ]);
      };

      while (attempts < maxRetries) {
        try {
          result = await withTimeout(chat.sendMessage({ message: parts }), 60000);
          break;
        } catch (error: any) {
          attempts++;
          const isRetryable = error.message?.includes('504') || error.message?.includes('500') || error.message?.includes('fetch failed') || error.message?.includes('timed out');
          if (isRetryable && attempts < maxRetries) {
            activityService.log('THINKING', `Neural Static Detected. Rerouting...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            throw error;
          }
        }
      }

      if (!result) throw new Error("Neural Link Severed.");

      const inputStr = JSON.stringify(mergedHistory) + newMessage + systemInstruction;
      billingService.recordUsage(modelName, this.estimateTokens(inputStr), this.estimateTokens(result.text || ""));

      return {
        text: result.text,
        functionCalls: result.functionCalls || []
      };

    } catch (error: any) {
      console.error('Gemini Error:', error);
      return { text: `Neural Link Failure: ${error.message}`, functionCalls: [] };
    }
  }

  async deepScanDocument(fileName: string, content: string): Promise<any> {
    const prompt = `Task: Perform a forensic scan on "${fileName}". Snippet: ${content.substring(0, 2000)}. Return JSON with category, expiryDate, summary, and suggestedTask. DO NOT HALLUCINATE DATES. Respond ONLY with valid JSON.`;
    try {
      // Try Gemini first, fall back to OpenRouter
      if (getApiKey()) {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash',
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{}');
      } else if (openRouterService.isAvailable()) {
        const result = await openRouterService.sendAgentMessage(
          'You are a document scanner. Respond ONLY with valid JSON, no markdown.',
          prompt,
          []
        );
        try { return JSON.parse(result.text || '{}'); }
        catch { return { category: 'OPERATIONS', summary: result.text || 'Scan complete.' }; }
      }
      return { category: 'OPERATIONS', summary: 'No API key available for scanning.' };
    } catch (e) {
      return { category: 'OPERATIONS', summary: 'Scan failed.' };
    }
  }

  private prepareHistory(history: { role: string; content: string }[]) {
    const mappedHistory = history.map(h => {
      if (h.role === 'system') return { role: 'user', content: `[PILOT OVERRIDE]: ${h.content}` };
      return h;
    }).filter(h => (h.role === 'user' || h.role === 'model') && typeof h.content === 'string');

    const mergedHistory: any[] = [];
    if (mappedHistory.length > 0) {
      let current = { role: mappedHistory[0].role, parts: [{ text: mappedHistory[0].content }] };
      for (let i = 1; i < mappedHistory.length; i++) {
        if (mappedHistory[i].role === current.role) {
          current.parts[0].text += `\n\n${mappedHistory[i].content}`;
        } else {
          mergedHistory.push(current);
          current = { role: mappedHistory[i].role, parts: [{ text: mappedHistory[i].content }] };
        }
      }
      mergedHistory.push(current);
    }
    return mergedHistory;
  }

  /**
   * Lightweight Gemini call for agents — accepts custom system prompt and tools.
   * Uses flash model, respects guardrails, records billing.
   */
  async sendAgentMessage(
    systemPrompt: string,
    message: string,
    toolDeclarations: FunctionDeclaration[]
  ): Promise<{ text: string; functionCalls: any[] }> {
    try {
      if (!guardrailService.isApiAllowed()) {
        return { text: '💤 API blocked — sleep mode active.', functionCalls: [] };
      }

      // Route through OpenRouter if no Gemini key is available
      if (!getApiKey() && openRouterService.isAvailable()) {
        return openRouterService.sendAgentMessage(systemPrompt, message, toolDeclarations);
      }

      if (!getApiKey()) {
        return { text: '⚠️ No API key configured. Add a Gemini or OpenRouter key in Vault → Secrets.', functionCalls: [] };
      }

      const ai = new GoogleGenAI({ apiKey: getApiKey() });
      const modelName = 'gemini-3-flash';

      const config: any = {
        systemInstruction: systemPrompt,
      };

      if (toolDeclarations.length > 0) {
        config.tools = [{ functionDeclarations: toolDeclarations }];
      }

      if (modelName.includes('gemini-3') || modelName.includes('gemini-2.5')) {
        config.thinkingConfig = { thinkingBudget: 512 };
      }

      const chat = ai.chats.create({ model: modelName, config, history: [] });

      let result;
      try {
        result = await chat.sendMessage({ message: [{ text: message }] });
      } catch (error: any) {
        // One retry for transient errors
        if (error.message?.includes('500') || error.message?.includes('504')) {
          await new Promise(r => setTimeout(r, 2000));
          result = await chat.sendMessage({ message: [{ text: message }] });
        } else {
          throw error;
        }
      }

      if (!result) throw new Error('Agent neural link failed.');

      billingService.recordUsage(modelName, this.estimateTokens(systemPrompt + message), this.estimateTokens(result.text || ''));

      return {
        text: result.text || '',
        functionCalls: result.functionCalls || []
      };
    } catch (error: any) {
      console.error('[AgentGemini] Error:', error.message);
      return { text: `Agent error: ${error.message}`, functionCalls: [] };
    }
  }
}

export const geminiService = new GeminiService();
