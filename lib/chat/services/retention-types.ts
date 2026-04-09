//--------------------------------------------------------------------------------
// Settings Interfaces and Defaults
//--------------------------------------------------------------------------------

const DEFAULT_SUMMARIZER_PROMPT = '';

export interface ChatRetentionSettings {
  summarize: {
    enabled: boolean;
    afterRounds: number;
  };
  ignore: {
    enabled: boolean;
    afterRounds: number;
  };
}

export interface RoundRetentionSettings {
  policy: 'default' | 'keep_full' | 'summarize' | 'ignore';
  summarizer?: {
    prompt: string;
    output: {
        type: 'word_count' | 'percentage';
        value: number;
    }
  };
}

export const DEFAULT_CHAT_RETENTION_SETTINGS: ChatRetentionSettings = {
  summarize: {
    enabled: true,
    afterRounds: 3,
  },
  ignore: {
    enabled: true,
    afterRounds: 10,
  },
};

export const DEFAULT_ROUND_RETENTION_SETTINGS: RoundRetentionSettings = {
  policy: 'summarize',
  summarizer: {
    prompt: DEFAULT_SUMMARIZER_PROMPT,
    output: {
        type: 'word_count',
        value: 250,
    }
  },
};

export interface SummaryData {
  summary: string;
  originalMessageCount: number;
  summarizedAt: Date;
}

export interface DialogueCompressionData {
  summary?: string;
  originalMessageCount?: number;
  summarizedAt?: Date;
  dialogues?: {
    [dialogueKey: string]: {
      summary: string;
      originalMessageCount: number;
      participants: [string, string];
    };
  };
} 