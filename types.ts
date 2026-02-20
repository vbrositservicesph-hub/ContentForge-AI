
export interface UserChannelInfo {
  niche: string;
  platform: 'YouTube' | 'Facebook' | 'Both';
  frequency: string;
  onboardingComplete: boolean;
}

export interface ProgressStats {
  youtube: {
    subs: number;
    watchTime: number;
  };
  facebook: {
    followers: number;
    viewMinutes: number;
  };
}

export interface VideoConcept {
  title: string;
  hook: string;
  structure: string;
  visualDirection: string;
  seo: {
    description: string;
    tags: string[];
  };
  sources?: GroundingSource[];
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface StoryboardScene {
  id: string;
  text: string;
  visualPrompt: string;
  imageUrl?: string;
  duration: number;
}

export interface StrategyPlan {
  weeks: {
    range: string;
    phase: string;
    focus: string[];
  }[];
}

export interface NicheAnalysis {
  name: string;
  trendScore: number;
  competition: 'Low' | 'Medium' | 'High';
  monetization: string;
  longevity: string;
  platformFit: string;
  sources?: GroundingSource[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export enum ViewState {
  Dashboard = 'dashboard',
  NicheSelector = 'niche',
  Strategy = 'strategy',
  Creator = 'creator',
  Monetization = 'monetization',
}