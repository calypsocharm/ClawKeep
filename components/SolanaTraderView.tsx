import React from 'react';
import BotControlPanel from './BotControlPanel';

// ─── SolanaTraderView ─────────────────────────────────────────────
// Now renders the Autonomous Bot directly (manual swap removed)
const SolanaTraderView: React.FC = () => {
    return (
        <div className="h-full overflow-y-auto p-4 md:p-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ffffff10 transparent' }}>
            <BotControlPanel />
        </div>
    );
};

export default SolanaTraderView;
