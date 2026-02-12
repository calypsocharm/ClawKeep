
import React, { useState } from 'react';
import { FlaskConical, TrendingUp, TrendingDown, RefreshCw, Calculator, Sparkles, Zap, DollarSign, PieChart as PieIcon, ArrowRight } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { activityService } from '../services/activityService';

const StrategySandbox: React.FC = () => {
  const [scenario, setScenario] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const [vars, setVars] = useState({
      insurancePremium: 2400,
      monthlyRevenue: 15000,
      marketingSpend: 1200,
      overhead: 4000,
      staffingCosts: 6500
  });

  const handleSimulate = async () => {
    if (!scenario.trim()) return;
    
    setIsSimulating(true);
    activityService.log('THINKING', `Neural Simulation: Running 'What-If' protocol...`);

    try {
        const prompt = `
            STRATEGY SANDBOX SIMULATION
            
            Current Operational Metrics:
            - Insurance Premium (Annual): $${vars.insurancePremium}
            - Monthly Gross Revenue: $${vars.monthlyRevenue}
            - Marketing Budget: $${vars.marketingSpend}
            - Operations Overhead: $${vars.overhead}
            - Staffing/Payroll: $${vars.staffingCosts}

            Operator Scenario: "${scenario}"

            Analyze this scenario for mathematical harmony. 
            Provide:
            1. Profitability Impact (Net Margin % change).
            2. Q4 Forecast Adjustment.
            3. Risk vs Reward Assessment.
            4. Claw's Strategic Recommendation.
            
            Be precise, analytical, and helpful. Use a "Virgo" meticulous tone.
        `;

        const response = await geminiService.sendMessage([], prompt, "Sandbox Mode Active: Neural Switchboard Priority Pro", "HIGH");
        setResult(response.text);
    } catch (error) {
        setResult("Error calculating mathematical harmony. Link integrity check required.");
    } finally {
        setIsSimulating(false);
        activityService.setIdle();
    }
  };

  return (
    <div className="p-10 h-full flex flex-col overflow-y-auto scrollbar-hide">
      <header className="mb-8 shrink-0 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tighter drop-shadow-md flex items-center gap-4">
                <FlaskConical className="w-10 h-10 text-rose-500" />
                Strategy Sandbox
            </h1>
            <p className="text-white/50 text-lg font-light tracking-wide uppercase text-xs">Simulate Profitable Harmony</p>
          </div>
          <div className="px-5 py-2.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3">
              <PieIcon className="w-4 h-4 text-rose-400" />
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Active Modelling</span>
          </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls */}
          <div className="lg:col-span-4 space-y-6">
              <div className="glass-panel p-8 rounded-[32px] border-white/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-[0.02]"><Calculator className="w-24 h-24 text-white" /></div>
                  <h3 className="text-white/60 text-[10px] font-bold mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Calculator className="w-3 h-3 text-rose-400" /> Basin Metrics
                  </h3>
                  
                  <div className="space-y-4">
                      {Object.entries(vars).map(([key, value]) => (
                          <div key={key}>
                              <label className="block text-[10px] text-white/30 uppercase font-mono mb-2">{key.replace(/([A-Z])/g, ' $1')}</label>
                              <div className="relative group">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
                                  <input 
                                    type="number"
                                    value={value}
                                    onChange={(e) => setVars({...vars, [key]: parseFloat(e.target.value)})}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 pl-8 pr-4 text-xs text-white font-mono focus:outline-none focus:border-rose-500/50 transition-all"
                                  />
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="glass-panel p-8 rounded-[32px] border-rose-500/20 bg-rose-500/5">
                  <h3 className="text-white font-bold text-xs mb-4 uppercase tracking-widest flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-rose-400" /> Construct Scenario
                  </h3>
                  <textarea 
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    placeholder="e.g., 'If we increase umbrella coverage to $5M, how does that impact Q4 margins?'"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-white h-40 focus:outline-none focus:border-rose-500 font-mono resize-none mb-4 scrollbar-hide shadow-inner"
                  />
                  <button 
                    onClick={handleSimulate}
                    disabled={isSimulating}
                    className="group w-full py-4 bg-gradient-to-br from-rose-500 to-rose-700 text-white rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-lg hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] disabled:opacity-50 transition-all"
                  >
                      {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      Execute Simulation
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </button>
              </div>
          </div>

          {/* Result View */}
          <div className="lg:col-span-8 flex flex-col">
              <div className="flex-1 glass-panel rounded-[40px] p-10 flex flex-col relative overflow-hidden border-rose-500/10 min-h-[600px]">
                  <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
                      <TrendingUp className="w-96 h-96 text-rose-500" />
                  </div>

                  {!result && !isSimulating ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
                          <FlaskConical className="w-20 h-20 mb-4" />
                          <p className="text-sm font-mono tracking-widest uppercase">Waiting for Strategic Hypothesis...</p>
                      </div>
                  ) : isSimulating ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-8">
                           <div className="w-20 h-20 border-4 border-rose-500/10 border-t-rose-500 rounded-full animate-spin"></div>
                           <div className="text-center space-y-3">
                               <p className="text-sm font-bold text-white uppercase tracking-widest animate-pulse">Neural Core Analyzing Profitability Vectors</p>
                               <div className="flex gap-2 justify-center">
                                   {[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 bg-rose-500/40 rounded-full animate-bounce" style={{animationDelay: `${i*0.2}s`}}></div>)}
                               </div>
                           </div>
                      </div>
                  ) : (
                      <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 h-full flex flex-col">
                          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                                  </div>
                                  <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Strategic Impact Report</h2>
                              </div>
                              <span className="text-[10px] font-mono text-white/20 uppercase">Simulation Protocol v2.5.3</span>
                          </div>
                          <div className="flex-1 prose prose-invert max-w-none text-sm leading-relaxed text-white/80 whitespace-pre-wrap font-mono overflow-y-auto scrollbar-hide pr-4 mb-8">
                              {result}
                          </div>
                          
                          <div className="mt-auto p-6 bg-rose-500/10 border border-rose-500/20 rounded-[32px] flex items-center gap-6 shadow-xl backdrop-blur-md">
                              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 flex items-center justify-center shrink-0 border border-rose-500/30">
                                  <Zap className="w-6 h-6 text-rose-500 shadow-glow" />
                              </div>
                              <div className="flex-1">
                                  <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                      <Sparkles className="w-3 h-3" /> Claw's Verdict
                                  </h4>
                                  <p className="text-xs text-white/70 italic leading-relaxed">"The mathematical harmony of this scenario looks promising. Should I initialize the necessary mission directives to make this profitable?"</p>
                              </div>
                              <button className="px-6 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-xl text-[10px] font-bold text-white uppercase tracking-widest transition-all">Proceed</button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default StrategySandbox;
