
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ViewState, 
  UserChannelInfo, 
  ProgressStats, 
  NicheAnalysis, 
  StrategyPlan, 
  VideoConcept,
  StoryboardScene
} from './types';
import { NICHES, PLATFORMS, FREQUENCIES, WORKFLOW } from './constants';
import { 
  analyzeNiche, 
  generateStrategy, 
  generateVideoConcepts, 
  generateScript, 
  splitScriptIntoStoryboard,
  generateImageForScene
} from './geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.Dashboard);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [creatorMode, setCreatorMode] = useState<'script' | 'storyboard'>('script');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  // Persisted Workspace States
  const [userInfo, setUserInfo] = useState<UserChannelInfo>(() => {
    const saved = localStorage.getItem('cf_user_info');
    return saved ? JSON.parse(saved) : {
      niche: '',
      platform: 'Both',
      frequency: '3x/week',
      onboardingComplete: false,
    };
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

  const [activeScript, setActiveScript] = useState<string | null>(null);
  const [storyboard, setStoryboard] = useState<StoryboardScene[]>([]);

  useEffect(() => {
    localStorage.setItem('cf_user_info', JSON.stringify(userInfo));
    localStorage.setItem('cf_niche_analysis', JSON.stringify(nicheAnalysis));
    localStorage.setItem('cf_strategy', JSON.stringify(strategy));
    localStorage.setItem('cf_concepts', JSON.stringify(concepts));
  }, [userInfo, nicheAnalysis, strategy, concepts]);

  const [stats] = useState<ProgressStats>({
    youtube: { subs: 124, watchTime: 450 },
    facebook: { followers: 850, viewMinutes: 12500 }
  });

  const scriptAreaRef = useRef<HTMLTextAreaElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);

  const startOnboarding = async (niche: string) => {
    if (!niche) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const [analysis, strat, videoIdeas] = await Promise.all([
        analyzeNiche(niche),
        generateStrategy(niche, userInfo.platform),
        generateVideoConcepts(niche)
      ]);
      setNicheAnalysis(analysis);
      setStrategy(strat);
      setConcepts(videoIdeas);
      setUserInfo(prev => ({ ...prev, niche, onboardingComplete: true }));
      setView(ViewState.Dashboard);
    } catch (error: any) {
      setErrorMessage(error.message || "Engine failure during channel forging. Retrying...");
    } finally {
      setLoading(false);
    }
  };

  const fetchScript = async (concept: VideoConcept) => {
    setLoading(true);
    setCreatorMode('script');
    setErrorMessage(null);
    try {
      const script = await generateScript(concept);
      setActiveScript(script);
      setStoryboard([]);
    } catch (error: any) {
      setErrorMessage("Script generation timed out. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const convertToStoryboard = async () => {
    if (!activeScript) return;
    setLoading(true);
    try {
      const scenes = await splitScriptIntoStoryboard(activeScript);
      setStoryboard(scenes);
      setCreatorMode('storyboard');
    } catch (error: any) {
      setErrorMessage("Visual sequence mapping failed.");
    } finally {
      setLoading(false);
    }
  };

  const updateSceneVisual = async (sceneId: string) => {
    setLoading(true); 
    try {
      const scene = storyboard.find(s => s.id === sceneId);
      if (!scene) return;
      const imageUrl = await generateImageForScene(scene.visualPrompt);
      setStoryboard(prev => prev.map(s => s.id === sceneId ? { ...s, imageUrl } : s));
    } catch (error: any) {
      setErrorMessage("AI Image generation quota reached.");
    } finally {
      setLoading(false);
    }
  };

  const resetWorkspace = () => {
    if (window.confirm("Purge all strategy data and restart onboarding?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const wordCount = useMemo(() => activeScript?.trim().split(/\s+/).filter(Boolean).length || 0, [activeScript]);
  const estimatedReadTime = useMemo(() => Math.floor((wordCount / 150) * 60), [wordCount]);

  const applyFormatting = (prefix: string, suffix: string) => {
    const el = scriptAreaRef.current;
    if (!el || !activeScript) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newScript = activeScript.substring(0, start) + prefix + activeScript.substring(start, end) + suffix + activeScript.substring(end);
    setActiveScript(newScript);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + prefix.length, end + prefix.length); }, 0);
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (highlightLayerRef.current) highlightLayerRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  const renderHighlightedScript = (text: string) => {
    const parts = text.split(/(\[.*?\]|\b(?:HOOK|SCENE|OUTRO|INTRO|NARRATOR|TRANSITION|ACTION|INT\.|EXT\.):?|\*\*.*?\*\*|(?:\*|_).*?(?:\*|_))/gi);
    return parts.map((part, i) => {
      if (part.startsWith('[') && part.endsWith(']')) return <span key={i} className="text-cyan-400 font-bold bg-cyan-900/40 px-1 rounded-sm border border-cyan-500/20">{part}</span>;
      if (/^(?:HOOK|SCENE|OUTRO|INTRO|NARRATOR|TRANSITION|ACTION|INT\.|EXT\.):?/i.test(part)) return <span key={i} className="text-blue-500 font-black uppercase tracking-widest">{part}</span>;
      if (part.startsWith('**')) return <span key={i} className="text-white font-extrabold">{part}</span>;
      if (part.startsWith('_') || part.startsWith('*')) return <span key={i} className="text-slate-300 italic">{part}</span>;
      return <span key={i}>{part}</span>;
    });
  };

  if (!userInfo.onboardingComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100">
        <div className="max-w-lg w-full space-y-8 bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2rem] border border-slate-800/50 shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="text-center">
            <div className="inline-flex p-4 bg-blue-600/10 rounded-2xl mb-4 border border-blue-500/20">
              <span className="text-3xl">🚀</span>
            </div>
            <h1 className="text-4xl font-black text-white">ContentForge <span className="text-blue-500">AI</span></h1>
            <p className="text-slate-400 text-sm mt-2">Initialize your autonomous content engine.</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-3 text-slate-500">Select Niche Path</label>
              <div className="grid grid-cols-2 gap-2">
                {NICHES.map(n => (
                  <button key={n} onClick={() => setUserInfo({ ...userInfo, niche: n })} className={`px-3 py-3 rounded-xl border text-xs font-bold transition-all ${userInfo.niche === n ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-800/80'}`}>{n}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Platform</label>
                <select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm" value={userInfo.platform} onChange={e => setUserInfo({ ...userInfo, platform: e.target.value as any })}>{PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}</select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Velocity</label>
                <select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm" value={userInfo.frequency} onChange={e => setUserInfo({ ...userInfo, frequency: e.target.value })}>{FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}</select>
              </div>
            </div>

            {errorMessage && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-4 rounded-xl">{errorMessage}</div>}

            <button onClick={() => startOnboarding(userInfo.niche)} disabled={!userInfo.niche || loading} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black transition-all shadow-xl disabled:opacity-50">
              {loading ? "Forging Intelligence Assets..." : "Execute Launch Sequence"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0f18] text-slate-200 overflow-hidden">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={toggleSidebar} />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0d1320] border-r border-slate-800/50 flex flex-col transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-800/50">
          <div className="flex items-center space-x-2"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white">C</div><h2 className="text-lg font-black text-white italic uppercase">Forge</h2></div>
          <button onClick={toggleSidebar} className="lg:hidden text-slate-500">✕</button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {[{ id: ViewState.Dashboard, label: 'Overview', icon: '🏠' }, { id: ViewState.Strategy, label: 'Strategy', icon: '🎯' }, { id: ViewState.Creator, label: 'Studio', icon: '🎬' }, { id: ViewState.Monetization, label: 'Revenue', icon: '💎' }].map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center space-x-3 group ${view === item.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800/50'}`}>
              <span className="text-xl">{item.icon}</span><span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 space-y-2">
          <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
             <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Active Empire</span>
             <p className="font-black text-white text-sm">{userInfo.niche}</p>
          </div>
          <button onClick={resetWorkspace} className="w-full p-3 rounded-xl border border-red-500/20 text-red-500/60 hover:text-red-400 hover:bg-red-500/5 text-[10px] font-bold uppercase tracking-widest transition-all">Reset Factory</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative p-4 md:p-8">
        <header className="lg:hidden mb-6 flex items-center justify-between sticky top-0 bg-[#0a0f18]/80 backdrop-blur-md py-4 z-30">
          <button onClick={toggleSidebar} className="p-2 bg-slate-800 rounded-lg text-white">☰</button>
          <h2 className="font-black italic text-white uppercase tracking-widest">Forge AI</h2>
          <div className="w-10" />
        </header>

        {loading && <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center"><div className="text-center space-y-4"><div className="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto"></div><p className="text-xs font-black text-blue-500 uppercase tracking-widest animate-pulse">Processing Neural Request...</p></div></div>}

        {errorMessage && <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-4 rounded-2xl flex justify-between items-center animate-in slide-in-from-top-4"><span>{errorMessage}</span><button onClick={() => setErrorMessage(null)}>✕</button></div>}

        {view === ViewState.Dashboard && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div className="flex justify-between items-end">
                <div className="space-y-1"><h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Strategic <span className="text-blue-600">Overview</span></h1><p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Intelligence Pulse</p></div>
                <div className="px-4 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-xl text-[10px] font-black text-blue-500 uppercase tracking-widest">Trend Score: {nicheAnalysis?.trendScore}/10</div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="YouTube Subs" value={stats.youtube.subs} target={1000} color="red" />
              <StatCard title="Watch Hours" value={stats.youtube.watchTime} target={4000} color="blue" />
              <StatCard title="FB Followers" value={stats.facebook.followers} target={5000} color="indigo" />
              <StatCard title="FB View Mins" value={stats.facebook.viewMinutes} target={60000} color="emerald" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-[#0d1320] border border-slate-800/50 p-8 rounded-[2rem] shadow-xl">
                    <h3 className="text-lg font-black text-white uppercase italic tracking-widest mb-6">Workflow Optimization</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {WORKFLOW.map(w => <div key={w.day} className="p-4 bg-slate-900 rounded-2xl border border-slate-800/50 flex items-center space-x-4"><span className="text-[10px] font-black text-blue-500 uppercase">{w.day.slice(0,3)}</span><p className="text-xs font-bold text-slate-300">{w.task}</p></div>)}
                    </div>
                </div>
                <div className="bg-[#0d1320] border border-slate-800/50 p-8 rounded-[2rem] shadow-xl space-y-4">
                    <h3 className="text-lg font-black text-white uppercase italic tracking-widest mb-4">Market Intel</h3>
                    <IntelligenceRow label="Comp. Level" value={nicheAnalysis?.competition} color="yellow" />
                    <IntelligenceRow label="Monetization" value={nicheAnalysis?.monetization} color="green" />
                    <IntelligenceRow label="Longevity" value={nicheAnalysis?.longevity} color="blue" />
                    <IntelligenceRow label="Native Fit" value={nicheAnalysis?.platformFit} color="purple" />
                </div>
            </div>
          </div>
        )}

        {view === ViewState.Strategy && strategy && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-700">
                <h1 className="text-3xl font-black text-white italic uppercase tracking-widest">90-Day <span className="text-blue-600">Roadmap</span></h1>
                {strategy.weeks.map((phase, idx) => (
                    <div key={idx} className="bg-[#0d1320] border border-slate-800/50 rounded-3xl overflow-hidden hover:border-blue-500/50 transition-all shadow-2xl">
                        <div className="bg-slate-900/50 p-6 flex items-center justify-between border-b border-slate-800/50">
                            <span className="text-sm font-black text-white uppercase tracking-widest">{phase.range}</span>
                            <span className="bg-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">{phase.phase}</span>
                        </div>
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {phase.focus.map((f, i) => <div key={i} className="flex items-center space-x-3 p-3 bg-slate-900 rounded-xl border border-slate-800"><span className="text-blue-500">✓</span><span className="text-xs font-bold text-slate-300">{f}</span></div>)}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {view === ViewState.Creator && (
            <div className="max-w-7xl mx-auto space-y-6 animate-in zoom-in-95 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                      <h1 className="text-3xl font-black text-white italic uppercase tracking-widest">Creator <span className="text-blue-600">Studio</span></h1>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Asset Forging Laboratory</p>
                    </div>
                    
                    {/* ENHANCED MODE SWITCHER */}
                    {activeScript && (
                        <div className="relative bg-[#0d1320] p-1.5 rounded-[1.25rem] border border-slate-800 shadow-2xl flex items-center overflow-hidden min-w-[240px]">
                            {/* Animated Background Highlight */}
                            <div 
                              className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-blue-600 rounded-[1rem] shadow-lg shadow-blue-600/30 transition-all duration-300 ease-out z-0`} 
                              style={{ left: creatorMode === 'script' ? '6px' : 'calc(50% + 0px)' }}
                            />
                            
                            <button 
                              onClick={() => setCreatorMode('script')} 
                              className={`relative z-10 flex-1 py-2.5 px-4 rounded-[1rem] flex items-center justify-center space-x-2 transition-all duration-300 ${creatorMode === 'script' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                              <span className="text-sm">🖋️</span>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Script</span>
                            </button>
                            
                            <button 
                              onClick={() => setCreatorMode('storyboard')} 
                              className={`relative z-10 flex-1 py-2.5 px-4 rounded-[1rem] flex items-center justify-center space-x-2 transition-all duration-300 ${creatorMode === 'storyboard' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                              <span className="text-sm">🎬</span>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Visuals</span>
                              {storyboard.length > 0 && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse ml-1" />}
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    <div className="xl:col-span-3 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                        {concepts.map((concept, idx) => (
                            <button key={idx} onClick={() => fetchScript(concept)} className="w-full text-left bg-[#0d1320] border border-slate-800/50 p-5 rounded-2xl hover:border-blue-600/50 transition-all group relative">
                                <h3 className="text-xs font-black text-white group-hover:text-blue-500 uppercase tracking-tight">{concept.title}</h3>
                                <p className="text-[10px] text-slate-500 mt-2 line-clamp-2">{concept.hook}</p>
                                <span className="absolute top-2 right-2 text-[10px] font-black opacity-10">0{idx+1}</span>
                            </button>
                        ))}
                    </div>

                    <div className="xl:col-span-9">
                        {creatorMode === 'script' ? (
                            <div className="bg-[#0d1320] border border-slate-800/50 rounded-[2.5rem] min-h-[60vh] relative flex flex-col overflow-hidden shadow-2xl">
                                <div className="p-4 border-b border-slate-800/50 bg-slate-900/50 flex justify-between items-center">
                                    <div className="flex space-x-2">
                                        <button onClick={() => applyFormatting('**', '**')} className="p-2 hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-400 hover:text-white">B</button>
                                        <button onClick={() => applyFormatting('_', '_')} className="p-2 hover:bg-slate-800 rounded-lg text-xs italic font-bold text-slate-400 hover:text-white">I</button>
                                        <button onClick={() => applyFormatting('[', ']')} className="p-2 hover:bg-slate-800 rounded-lg text-[10px] font-black text-cyan-500">[Visual]</button>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block">{wordCount} words</span>
                                        <span className="text-[9px] font-bold text-slate-600 uppercase">Est. {estimatedReadTime}s speak time</span>
                                    </div>
                                </div>
                                <div className="flex-1 relative">
                                    <textarea ref={scriptAreaRef} value={activeScript || ''} onChange={e => setActiveScript(e.target.value)} onScroll={handleScroll} className="absolute inset-0 w-full h-full p-8 font-mono text-sm leading-loose bg-transparent text-transparent caret-blue-500 outline-none resize-none z-10 custom-scrollbar" placeholder="Select a concept to begin script generation..." />
                                    <div ref={highlightLayerRef} className="absolute inset-0 w-full h-full p-8 font-mono text-sm leading-loose pointer-events-none z-0 whitespace-pre-wrap select-none text-slate-400 overflow-hidden">{activeScript ? renderHighlightedScript(activeScript) : <div className="h-full flex items-center justify-center opacity-20 italic">Awaiting Concept Selection...</div>}</div>
                                </div>
                                {activeScript && <button onClick={convertToStoryboard} className="absolute bottom-6 right-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/20 z-20 hover:scale-105 transition-transform">Forge Storyboard</button>}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                                {storyboard.map((scene, idx) => (
                                    <div key={scene.id} className="bg-[#0d1320] border border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl group">
                                        <div className="aspect-video bg-slate-950 relative">
                                            {scene.imageUrl ? <img src={scene.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-4"><button onClick={() => updateSceneVisual(scene.id)} className="px-6 py-2 bg-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all hover:scale-105">Forge Visual</button></div>}
                                            <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded text-[10px] font-black uppercase italic text-blue-500">SCENE 0{idx+1}</div>
                                            <div className="absolute top-4 right-4 bg-blue-600 px-2 py-1 rounded text-[10px] font-black text-white">{scene.duration}s</div>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            <p className="text-xs font-bold text-slate-200 italic leading-relaxed">"{scene.text}"</p>
                                            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/50 text-[9px] text-slate-500 uppercase leading-relaxed">{scene.visualPrompt}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {view === ViewState.Monetization && (
            <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-left-8 duration-700">
                <h1 className="text-3xl font-black text-white italic uppercase tracking-widest">Revenue <span className="text-blue-600">Track</span></h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <MonetizationModule platform="YouTube Partner" requirements={[{ label: 'Subs', current: stats.youtube.subs, goal: 1000 }, { label: 'Watch Hrs', current: stats.youtube.watchTime, goal: 4000 }]} color="red" />
                    <MonetizationModule platform="Facebook Ads" requirements={[{ label: 'Followers', current: stats.facebook.followers, goal: 5000 }, { label: 'View Mins', current: stats.facebook.viewMinutes, goal: 60000 }]} color="indigo" />
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

const StatCard = ({ title, value, target, color }: any) => {
  const progress = Math.min(100, (value / target) * 100);
  const colors: any = { red: 'bg-red-500', blue: 'bg-blue-600', indigo: 'bg-indigo-600', emerald: 'bg-emerald-500' };
  return (
    <div className="bg-[#0d1320] border border-slate-800/50 p-6 rounded-3xl space-y-4 shadow-xl">
      <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest"><span>{title}</span><span>{Math.round(progress)}%</span></div>
      <div className="flex items-baseline space-x-2"><span className="text-2xl font-black text-white italic">{value.toLocaleString()}</span><span className="text-[10px] font-black text-slate-600">/ {target.toLocaleString()}</span></div>
      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden"><div className={`h-full ${colors[color]} transition-all duration-1000`} style={{ width: `${progress}%` }}></div></div>
    </div>
  );
};

const IntelligenceRow = ({ label, value, color }: any) => {
  const colorMap: any = { yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', green: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20', purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20' };
  return (
    <div className="flex justify-between items-center p-3 rounded-xl bg-slate-900/50 border border-slate-800">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <span className={`text-[9px] font-black px-3 py-1 rounded-lg border uppercase tracking-widest ${colorMap[color]}`}>{value}</span>
    </div>
  );
};

const MonetizationModule = ({ platform, requirements, color }: any) => (
    <div className={`border rounded-[2.5rem] p-10 space-y-8 shadow-2xl relative overflow-hidden bg-opacity-5 ${color === 'red' ? 'border-red-500/20 bg-red-500' : 'border-indigo-500/20 bg-indigo-500'}`}>
      <h3 className="text-xl font-black text-white italic uppercase tracking-widest">{platform}</h3>
      <div className="space-y-8">
        {requirements.map((req: any) => {
          const progress = Math.min(100, (req.current / req.goal) * 100);
          return (
            <div key={req.label} className="space-y-3">
              <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 tracking-widest"><span>{req.label}</span><span>{req.current.toLocaleString()} / {req.goal.toLocaleString()}</span></div>
              <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden shadow-inner"><div className={`h-full transition-all duration-1000 ${color === 'red' ? 'bg-red-500' : 'bg-indigo-600'}`} style={{ width: `${progress}%` }}></div></div>
            </div>
          );
        })}
      </div>
    </div>
);

export default App;
