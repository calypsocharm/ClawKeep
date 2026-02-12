
import { ThinkingDepth } from '../types';

export type ActivityType = 'BROWSING' | 'TERMINAL' | 'THINKING' | 'SCANNING' | 'IDLE';

export interface ActivityLog {
    type: ActivityType;
    message: string;
    timestamp: Date;
    meta?: any;
}

type ActivityListener = (logs: ActivityLog[]) => void;
type StateListener = (isActive: boolean) => void;
type LoadListener = (load: number) => void;

class ActivityService {
    private logs: ActivityLog[] = [];
    private isActive: boolean = false;
    private neuralLoad: number = 12; // Initial simulated load %
    private listeners: ActivityListener[] = [];
    private stateListeners: StateListener[] = [];
    private loadListeners: LoadListener[] = [];

    log(type: ActivityType, message: string, meta?: any) {
        const newLog = { type, message, timestamp: new Date(), meta };
        this.logs = [newLog, ...this.logs.slice(0, 19)];
        this.notifyLogs();
        
        if (type !== 'IDLE' && !this.isActive) {
            this.isActive = true;
            this.notifyState();
        }

        // Increment neural load based on activity
        if (type !== 'IDLE') {
            this.neuralLoad = Math.min(100, this.neuralLoad + (type === 'THINKING' ? 4 : 1));
            this.notifyLoad();
        }
    }

    setIdle() {
        this.isActive = false;
        this.notifyState();
    }

    resetNeuralLoad() {
        this.neuralLoad = 5; // Reset to a base baseline after RET
        this.notifyLoad();
    }

    getLogs() {
        return this.logs;
    }

    getIsActive() {
        return this.isActive;
    }

    getNeuralLoad() {
        return this.neuralLoad;
    }

    subscribeLogs(callback: ActivityListener) {
        this.listeners.push(callback);
        return () => { this.listeners = this.listeners.filter(cb => cb !== callback); };
    }

    subscribeState(callback: StateListener) {
        this.stateListeners.push(callback);
        return () => { this.stateListeners = this.stateListeners.filter(cb => cb !== callback); };
    }

    subscribeLoad(callback: LoadListener) {
        this.loadListeners.push(callback);
        callback(this.neuralLoad);
        return () => { this.loadListeners = this.loadListeners.filter(cb => cb !== callback); };
    }

    private notifyLogs() {
        this.listeners.forEach(cb => cb(this.logs));
    }

    private notifyState() {
        this.stateListeners.forEach(cb => cb(this.isActive));
    }

    private notifyLoad() {
        this.loadListeners.forEach(cb => cb(this.neuralLoad));
    }
}

export const activityService = new ActivityService();
