
export interface BrainstormAgent {
  role: string;
  prompt: string;
}

export interface BrainstormStep {
  id: number;
  name: string;
  agents: BrainstormAgent[];
  completed?: boolean;
}

export interface StepProgress {
  stepIndex: number;
  completed: boolean;
}

export interface BrainstormResponse {
  message?: string;
  progress?: StepProgress;
  completion?: string;
  error?: string;
  type?: 'complete' | 'progress';
  data?: any; // Using any for now, but ideally this should be properly typed
} 