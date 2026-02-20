import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ViewState, 
  UserChannelInfo, 
  NicheAnalysis, 
  StrategyPlan, 
  VideoConcept,
  StoryboardScene
} from './types';
import { NICHES, WORKFLOW } from './constants';
import { 
  analyzeNiche, 
  generateStrategy, 
  generateVideoConcepts, 
  generateScript, 
  splitScriptIntoStoryboard,
  generateImageForScene,
  generateVoiceover,
  generateViralHooks,
  compileVideoWithVeo
} from './geminiService';

// --- Global Types Extensions ---
declare global {
  // Use the pre-defined AIStudio type to avoid conflicts and modifier mismatches
  interface Window {
    readonly aistudio: AIStudio;
  }
}

// --- Shared Components ---
const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-8 animate-fade">
    <h1 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter uppercase leading-none mb-1">
      {title.split(' ')[0]} <span className="text-blue-500">{title.split(' ').slice(1).join(' ')}</span>
    </h1>
    {subtitle && <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] ml-0.5">{subtitle}</p>}
  </div>
);

const Card = ({ children, className = "", hover = true }: { children: React.ReactNode; className?: string; hover?: boolean }) => (
  <div className={`glass-card p-6 rounded-[2rem] border border-white/5 relative overflow-hidden ${hover ? 'hover:scale-[1.01] hover:border-blue-500/20' : ''} ${className}`}>
    {children}
  </div>
);

// --- Audio Logic ---
async function playBase64Audio(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  
  const dataInt16 = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
}

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.Dashboard);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'ideas' | 'hooks'>('ideas');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Persistence States
  const [userInfo, setUserInfo] = useState<UserChannelInfo>(() => {
    const saved = localStorage.getItem('cf_user_info');
    return saved ? JSON.parse(saved) : { niche: '', platform: 'Both', frequency: '3x/week', onboardingComplete: false };
  });
  const [nicheAnalysis, setNicheAnalysis] = useState<NicheAnalysis | null>(() => {
    const saved = localStorage.getItem('cf_niche_analysis');
    return saved ? JSON.parse(saved) : null;
  });
  const [strategy, setStrategy] = useState<StrategyPlan | null>(() => {
    const saved = localStorage.getItem('cf_strategy');
    return saved ? JSON.parse(saved) : null;
  });
  const [concepts, setConcepts] = useState<VideoConcept[]>(() => {
    const saved = localStorage.getItem('cf_concepts');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeConcept, setActiveConcept] = useState<VideoConcept | null>(null);
  const [activeScript, setActiveScript] = useState<string | null>(null);
  const [viralHooks, setViralHooks] = useState<{hook: string, reason: string}[]>([]);
  const [hooksLoading, setHooksLoading] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);

  const scriptAreaRef = useRef<HTMLTextAreaElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('cf_user_info', JSON.stringify(userInfo));
    localStorage.setItem('cf_niche_analysis', JSON.stringify(nicheAnalysis));
    localStorage.setItem('cf_strategy', JSON.stringify(strategy));
    localStorage.setItem('cf_concepts', JSON.stringify(concepts));
  }, [userInfo, nicheAnalysis, strategy, concepts]);

  const handleInitialize = async (niche: string) => {
    if (!niche) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const [analysis, strat, ideas] = await Promise.all([
        analyzeNiche(niche),
        generateStrategy(niche, userInfo.platform),
        generateVideoConcepts(niche)
      ]);
      setNicheAnalysis(analysis);
      setStrategy(strat);
      setConcepts(ideas);
      setUserInfo(prev => ({ ...prev, niche, onboardingComplete: true }));
      setView(ViewState.Dashboard);
    } catch (e: any) {
      setErrorMessage(e.message || "Initialization error.");
    } finally {
      setLoading(false);
    }
  };

  const handleScriptRequest = async (concept: VideoConcept) => {
    setLoading(true);
    setActiveConcept(concept);
    setErrorMessage(null);
    try {
      const script = await generateScript(concept);
      setActiveScript(script);
      setView(ViewState.Creator);
    } catch (e: any) {
      setErrorMessage(e.message || "Script engine failure.");
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceProduction = async () => {
    if (!activeScript) return;
    setVoiceLoading(true);
    try {
      const audioData = await generateVoiceover(activeScript);
      await playBase64Audio(audioData);
    } catch (e: any) {
      setErrorMessage("Voice synthesizer offline.");
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleProduceVideo = async () => {
    if (!activeScript) return;
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      setErrorMessage("Video Production requires a Billing-Enabled API Key.");
      await window.aistudio.openSelectKey();
      // Proceed assuming success as per guidelines race condition note
    }
    setLoading(true);
    try {
      const videoUrl = await compileVideoWithVeo(activeScript, []);
      window.open(videoUrl, '_blank');
    } catch (e: any) {
      // Handle the case where the project/key is not found or inactive
      if (e.message?.includes("Requested entity was not found")) {
        setErrorMessage("API Key invalid or project not active. Resetting key selection.");
        await window.aistudio.openSelectKey();
      } else {
        setErrorMessage("Veo Engine reached quota: " + e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderScriptOverlay = (text: string) => {
    const parts = text.split(/(\[.*?\]|\b(?:SCENE|HOOK|OUTRO|INTRO|NARRATOR):?|\*\*.*?\*\*)/gi);
    return parts.map((part, i) => {
      if (part.startsWith('[') && part.endsWith(']')) return <span key={i} className="text-cyan-400 font-bold bg-cyan-500/10 px-1 rounded">{part}</span>;
      if (/^(?:SCENE|HOOK|OUTRO|INTRO|NARRATOR):?/i.test(part)) return <span key={i} className="text-blue-500 font-black uppercase text-[10px] tracking-widest">{part}</span>;
      if (part.startsWith('**')) return <span key={i} className="text-white font-bold">{part}</span>;
      return <span key={i}>{part}</span>;
    });
  };

  if (!userInfo.onboardingComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
        <div className="max-w-md w-full glass p-10 rounded-[3rem] space-y-10 shadow-2xl border border-white/5 animate-fade">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-blue-900/40 transform rotate-3 hover:rotate-0 transition-transform">
              <span className="font-black text-white text-4xl">C</span>
            </div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">FORGE<span className="text-blue-500">AI</span></h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em]">The Faceless Empire Builder</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {NICHES.map(n => (
              <button key={n} onClick={() => setUserInfo({ ...userInfo, niche: n })} className={`px-4 py-4 rounded-2xl border text-[11px] font-black uppercase transition-all duration-300 ${userInfo.niche === n ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-900/30' : 'bg-slate-900/50 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>{n}</button>
            ))}
          </div>
          <button onClick={() => handleInitialize(userInfo.niche)} disabled={!userInfo.niche || loading} className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black text-sm uppercase tracking-[0.3em] shadow-xl disabled:opacity-50 transition-all active:scale-95">{loading ? "LINKING NODE..." : "INITIALIZE STUDIO"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden text-slate-300 bg-slate-950 font-['Plus_Jakarta_Sans']">
      {/* Sleek Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-60 glass border-r border-white/5 flex flex-col transition-all duration-500 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-8 flex items-center space-x-4">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/40">
            <span className="font-black text-white text-xl">C</span>
          </div>
          <span className="text-sm font-black tracking-tighter text-white uppercase italic">FORGE<span className="text-blue-500">AI</span></span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-6">
          {[
            { id: ViewState.Dashboard, label: 'Empire Feed', icon: '📊' }, 
            { id: ViewState.Strategy, label: '90D Roadmap', icon: '🎯' }, 
            { id: ViewState.Creator, label: 'Studio Ops', icon: '🎬' }, 
            { id: ViewState.Monetization, label: 'Revenue Hub', icon: '💎' }
          ].map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-5 px-5 py-4 rounded-[1.5rem] transition-all duration-300 ${view === item.id ? 'active-nav text-white' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}>
              <span className="text-xl">{item.icon}</span>
              <span className="font-bold text-[11px] uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="p-8 border-t border-white/5 bg-slate-900/30">
          <div className="p-4 rounded-2xl bg-blue-600/5 border border-blue-500/10">
            <span className="text-[9px] font-black uppercase text-blue-500/60 tracking-widest">Active Cluster</span>
            <p className="font-bold text-white text-xs truncate mt-2">{userInfo.niche}</p>
          </div>
        </div>
      </aside>

      {/* Main Command Workspace */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar p-6 lg:p-12 bg-[#020617]">
        <header className="lg:hidden mb-8 flex items-center justify-between glass p-4 rounded-3xl sticky top-0 z-40 shadow-xl border border-white/5">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 glass-card rounded-2xl">☰</button>
          <div className="font-black text-base tracking-tighter uppercase italic">FORGE<span className="text-blue-500">AI</span></div>
          <div className="w-12" />
        </header>

        {errorMessage && (
          <div className="mb-8 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-bold p-5 rounded-3xl flex justify-between items-center animate-fade backdrop-blur-xl shadow-2xl">
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="ml-6 opacity-40 hover:opacity-100 transition-opacity">✕</button>
          </div>
        )}

        {view === ViewState.Dashboard && (
          <div className="max-w-7xl mx-auto space-y-12">
            <SectionHeader title="EMPIRE PULSE" subtitle="High-Frequency Growth Monitoring" />
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Network" value={1420} target={10000} color="blue" suffix=" Reach" />
              <StatCard title="Retention" value={68} target={100} color="emerald" suffix="%" />
              <StatCard title="CPM Avg" value={18.4} target={25} color="indigo" suffix="$" />
              <StatCard title="Conversion" value={4.2} target={10} color="red" suffix="%" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 glass p-10 rounded-[3rem] border border-white/5 space-y-8">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Operational Protocol</h3>
                  <span className="text-[11px] text-blue-500 font-bold px-3 py-1 rounded-full bg-blue-500/10">SYSTEM STABLE</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {WORKFLOW.map(w => (
                    <div key={w.day} className="p-6 glass-card rounded-[2rem] border border-white/5 flex items-center space-x-5 transition-all hover:bg-blue-600/5 group">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/5 flex flex-col items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-500 transition-all shadow-inner">
                        <span className="text-[9px] font-black text-slate-500 group-hover:text-white uppercase leading-none">{w.day.slice(0,3)}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-300 leading-tight group-hover:text-white transition-colors">{w.task}</p>
                    </div>
                  ))}
                </div>
                {/* Mandatory Display of Search Grounding Sources */}
                {nicheAnalysis?.sources && nicheAnalysis.sources.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-white/5 animate-fade">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      Market Intelligence Sources
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {nicheAnalysis.sources.map((s, i) => (
                        <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-500/5 border border-blue-500/10 rounded-xl text-[9px] font-bold text-blue-400 hover:bg-blue-500/10 transition-colors truncate max-w-[200px]">
                          {s.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="glass p-10 rounded-[3rem] space-y-8 border border-white/5 bg-gradient-to-br from-slate-900/50 to-transparent">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Neural Vitals</h3>
                <VitalRow label="Market Volatility" value={nicheAnalysis?.competition} status="Nominal" />
                <VitalRow label="Yield Index" value={nicheAnalysis?.monetization} status="Optimal" />
                <VitalRow label="Platform Alpha" value={nicheAnalysis?.platformFit} status="Primary" />
                
                <div className="mt-10 pt-10 border-t border-white/5 space-y-4">
                  <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest">Global Trend Spotting</p>
                  {['AI SaaS Faceless News', 'Stoicism 2.0', 'Luxury Tech Unboxing'].map((t, i) => (
                    <div key={i} className="flex items-center space-x-3 text-xs font-bold text-slate-400 group cursor-pointer">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 group-hover:scale-150 transition-transform shadow-[0_0_8px_rgba(37,99,235,0.6)]"></div>
                      <span className="group-hover:text-blue-400 transition-colors italic">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === ViewState.Creator && (
          <div className="max-w-full mx-auto space-y-8 animate-fade h-full flex flex-col">
            <SectionHeader title="CREATOR WORKBENCH" subtitle="Multi-Modal Script & Production Studio" />
            
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1">
              <div className="xl:col-span-3 space-y-6 overflow-y-auto custom-scrollbar pr-2 max-h-[80vh]">
                <div className="flex glass p-2 rounded-2xl border border-white/5 sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md">
                  <button onClick={() => setSidebarTab('ideas')} className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all ${sidebarTab === 'ideas' ? 'bg-slate-800 text-blue-500 shadow-xl' : 'text-slate-500'}`}>IDEAS</button>
                  <button onClick={() => setSidebarTab('hooks')} className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all ${sidebarTab === 'hooks' ? 'bg-slate-800 text-cyan-500 shadow-xl' : 'text-slate-500'}`}>HOOKS</button>
                </div>
                
                {sidebarTab === 'ideas' && concepts.map((c, i) => (
                  <button key={i} onClick={() => handleScriptRequest(c)} className={`w-full text-left glass-card p-6 rounded-[2rem] border group transition-all ${activeConcept?.title === c.title ? 'border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.15)] bg-blue-500/5' : 'border-white/5'}`}>
                    <h4 className="text-xs font-black text-white group-hover:text-blue-500 uppercase tracking-tight leading-tight">{c.title}</h4>
                    <p className="text-[10px] text-slate-500 mt-3 line-clamp-2 leading-relaxed opacity-60 italic">{c.hook}</p>
                    {/* Display Reference Counts for Grounded Concepts */}
                    {c.sources && c.sources.length > 0 && (
                      <div className="mt-4 flex items-center gap-1">
                        <span className="text-[8px] font-black uppercase text-blue-500/50 bg-blue-500/10 px-2 py-0.5 rounded-full">
                          {c.sources.length} Data Points
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="xl:col-span-9 h-full flex flex-col">
                <div className="glass rounded-[3rem] border border-white/5 shadow-2xl flex flex-col flex-1 overflow-hidden relative">
                  <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-slate-900/40 backdrop-blur-xl">
                    <div className="flex space-x-3">
                      <button onClick={handleVoiceProduction} disabled={voiceLoading || !activeScript} className="px-6 py-3 bg-blue-600/10 hover:bg-blue-600 hover:text-white rounded-2xl text-[11px] font-black text-blue-500 uppercase transition-all border border-blue-500/20 disabled:opacity-30">
                        {voiceLoading ? "RENDERING..." : "🎙️ Render Voice"}
                      </button>
                      <button onClick={handleProduceVideo} disabled={loading || !activeScript} className="px-6 py-3 bg-indigo-600/10 hover:bg-indigo-600 hover:text-white rounded-2xl text-[11px] font-black text-indigo-500 uppercase transition-all border border-indigo-500/20 disabled:opacity-30">
                        {loading ? "PRODUCING..." : "🎬 Produce Video (Veo)"}
                      </button>
                    </div>
                    <div className="text-right">
                       <span className="block text-[10px] font-black text-blue-500 uppercase tracking-widest">{activeScript?.split(/\s+/).filter(Boolean).length || 0} WORDS</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 relative bg-slate-950/20">
                    <textarea 
                      ref={scriptAreaRef}
                      value={activeScript || ''}
                      onChange={e => setActiveScript(e.target.value)}
                      className="absolute inset-0 w-full h-full p-10 font-mono text-sm leading-relaxed bg-transparent text-transparent caret-blue-500 outline-none resize-none z-10 custom-scrollbar" 
                      placeholder="Select an idea to generate script architecture..."
                    />
                    <div ref={highlightLayerRef} className="absolute inset-0 w-full h-full p-10 font-mono text-sm leading-relaxed pointer-events-none z-0 whitespace-pre-wrap select-none text-slate-500 overflow-hidden">
                      {activeScript ? renderScriptOverlay(activeScript) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-5 space-y-4">
                           <span className="uppercase font-black tracking-[1em] text-5xl">OFFLINE</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === ViewState.Strategy && strategy && (
          <div className="max-w-6xl mx-auto space-y-12 animate-fade">
            <SectionHeader title="90-DAY STRATEGY" subtitle="Tactical Market Penetration Cycle" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {strategy.weeks.map((s, i) => (
                <div key={i} className="glass p-10 rounded-[3rem] border border-white/5 space-y-6 flex flex-col relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <span className="text-8xl font-black italic">W{i+1}</span>
                  </div>
                  <div className="flex justify-between items-center relative z-10">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{s.range}</span>
                    <span className="bg-blue-600/10 text-blue-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase border border-blue-500/20">{s.phase}</span>
                  </div>
                  <div className="space-y-4 relative z-10 flex-1">
                    {s.focus.map((f, fi) => (
                      <div key={fi} className="flex items-start space-x-5 p-5 glass-card rounded-2xl border border-white/5 hover:bg-white/5">
                        <div className="mt-1.5 w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.7)]"></div>
                        <span className="text-sm font-bold text-slate-200 leading-snug">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// --- View Helpers ---

const StatCard = ({ title, value, target, color, suffix = "" }: any) => {
  const progress = Math.min(100, (value / target) * 100);
  const colorMap: any = { 
    blue: 'from-blue-600 to-cyan-600 shadow-blue-500/30', 
    emerald: 'from-emerald-600 to-green-600 shadow-emerald-500/30', 
    indigo: 'from-indigo-600 to-blue-600 shadow-indigo-500/30', 
    red: 'from-red-600 to-rose-600 shadow-red-500/30' 
  };
  return (
    <Card className="flex flex-col justify-between space-y-6">
      <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
        <span>{title}</span>
        <span className="text-white opacity-40">{Math.round(progress)}%</span>
      </div>
      <div className="flex items-baseline space-x-2">
        <span className="text-4xl font-black text-white italic tracking-tighter">{value.toLocaleString()}{suffix}</span>
        <span className="text-[10px] font-bold text-slate-600">/ {target.toLocaleString()}</span>
      </div>
      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5 shadow-inner">
        <div className={`h-full bg-gradient-to-r ${colorMap[color]} transition-all duration-1000`} style={{ width: `${progress}%` }} />
      </div>
    </Card>
  );
};

const VitalRow = ({ label, value, status }: any) => (
  <div className="flex justify-between items-center p-5 glass-card rounded-[1.5rem] border border-white/5 transition-all hover:bg-white/5">
    <div>
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{label}</p>
      <p className="text-xs font-bold text-white uppercase">{value || 'SCANNING...'}</p>
    </div>
    <span className="text-[9px] font-black px-3 py-1 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20 uppercase tracking-widest shadow-inner">{status}</span>
  </div>
);

export default App;