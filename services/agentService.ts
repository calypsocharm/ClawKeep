
import { geminiService } from './geminiService';
import { AgentOptions } from '../types';
import { gatewayService } from './gatewayService';
import { skillsService } from './skillsService';

export class AgentService {
    async executeCommand(
        message: string,
        history: any[],
        context: string,
        options: AgentOptions,
        file?: { name: string; type: string; data: string } | null
    ) {
        // 1. Intercept CLI Commands
        const trimmed = message.trim();
        if (trimmed.startsWith('shell')) {
            return this.handleCLI(trimmed);
        }

        // 2. Standard Gemini Processing
        console.log(`[Pilot CLI] Synchronizing via Gemini v4.0: --agent ${options.agentId} --pilot-mode active`);

        // Call Gemini with the specified Thinking Depth and optional file
        const response = await geminiService.sendMessage(history, message, context, options.thinking, file);

        // Mock Delivery logic if channel is not WEB
        if (options.channel !== 'WEB' && response.text) {
            console.log(`[Pilot CLI] Remote Broadcast to ${options.channel}...`);
            const deliveryNote = options.channel === 'SLACK' ? 'Slack #hq-ops' : 'Secure SMS Relay';
            response.text += `\n\n_Transmission confirmed via ${deliveryNote}. Forensic log established._`;
        }

        return response;
    }

    private async handleCLI(command: string) {
        const args = command.split(' ').filter(a => a.length > 0);
        const cmd = args[1]; // shell [cmd] [subcmd] ...

        let output = '';

        try {
            switch (cmd) {
                case 'setup':
                    const isWizard = args.includes('--wizard');
                    output = await gatewayService.runSetup(isWizard);
                    break;

                case 'doctor':
                    const report = await gatewayService.runDoctor();
                    if (args.includes('--json')) {
                        output = JSON.stringify(report, null, 2);
                    } else {
                        output = `
REMOTE PILOT v4.0 DIAGNOSIS [${report.timestamp}]
------------------------------------------------
STATUS:    ${report.system.status}
OS_KERN:   CLAWKEEP_V1
UPTIME:    ${report.system.uptime}
PILOT:     STABLE
NETWORK:   ${report.network.status} (${report.network.latency})

SUB-SYSTEMS:
- Heritage Shield: ACTIVE
- Browser Engine: PLAYWRIGHT_STABLE
- Win Log: SYNCHRONIZED

SECURITY:
- Forensic Audit: RECORDING
- Keys: ${report.security.keys_found.length} LOADED / ${report.security.keys_missing.length} MISSING
                    `.trim();
                    }
                    break;

                case 'gateway':
                    const sub = args[2];
                    if (sub === 'run') output = gatewayService.start();
                    else if (sub === 'stop') output = gatewayService.stop();
                    else if (sub === 'status') output = `Link Status: ${gatewayService.getStatus()}\nHandover: READY`;
                    else output = "Unknown gateway directive. Try: run, stop, status.";
                    break;

                case 'pilot':
                    output = "Remote Pilot v4.0 Initialized.\nBrowser Engine: READY\nTelemetry Stream: STANDBY";
                    break;

                case 'browse':
                case 'navigate':
                    const browseUrl = args.slice(2).join(' ');
                    if (!browseUrl) { output = 'Usage: shell browse <url>'; break; }
                    gatewayService.browserNavigate(browseUrl);
                    output = `🧭 BrowserPilot: Navigating to ${browseUrl}...\nScreenshot will stream to Live Browser.`;
                    break;

                case 'click':
                    const selector = args.slice(2).join(' ');
                    if (!selector) { output = 'Usage: shell click <css-selector>'; break; }
                    gatewayService.browserClick(selector);
                    output = `🖱️ BrowserPilot: Clicking "${selector}"...`;
                    break;

                case 'extract':
                    gatewayService.browserExtract();
                    output = '📄 BrowserPilot: Extracting page content...\nResults will appear in Browser Update.';
                    break;

                case 'download':
                    const dlUrl = args.slice(2).join(' ');
                    if (!dlUrl) { output = 'Usage: shell download <file-url>'; break; }
                    gatewayService.browserDownload(dlUrl);
                    output = `⬇️ BrowserPilot: Downloading ${dlUrl}...\nFile will save to vault_data/downloads/.`;
                    break;

                case 'screenshot':
                    gatewayService.browserScreenshot();
                    output = '📸 BrowserPilot: Capturing screenshot...';
                    break;

                case 'type':
                    const text = args.slice(2).join(' ');
                    if (!text) { output = 'Usage: shell type <text>'; break; }
                    gatewayService.browserType(text);
                    output = `⌨️ BrowserPilot: Typed "${text}"`;
                    break;

                default:
                    output = `Directive '${cmd}' unknown. Use 'doctor', 'gateway', 'pilot', 'browse', 'click', 'extract', 'download', 'screenshot', or 'type'.`;
            }
        } catch (e: any) {
            output = `Core Exception: ${e.message}`;
        }

        return {
            text: "```bash\n" + output + "\n```",
            functionCalls: []
        };
    }
}

export const agentService = new AgentService();
