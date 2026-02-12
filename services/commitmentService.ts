/* commitmentService stub — ClawKeep fork doesn't use the commitment tracker */
type Listener = (counts: any) => void;

class CommitmentService {
    private listeners: Listener[] = [];

    getCounts() { return { active: 0, completed: 0, overdue: 0 }; }
    getCommitmentContext(): string { return 'No active commitments.'; }

    subscribe(callback: Listener): () => void {
        this.listeners.push(callback);
        return () => { this.listeners = this.listeners.filter(l => l !== callback); };
    }
}

export const commitmentService = new CommitmentService();
