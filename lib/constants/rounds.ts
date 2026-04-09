import { MessageCircle, Lightbulb, Users, Compass, FileText, ClipboardList, FileSearch, BookOpen, Settings } from 'lucide-react'
import type { RoundType } from '@/types/config-round'

export const ROUND_TYPES: Record<RoundType, {
  icon: any;
  description: string;
  longDescription: string;
  requiresExistingRounds?: boolean;
}> = {
  explore: {
    icon: Compass,
    description: "Go deep on a topic or idea",
    longDescription: "Agents will explore a topic or idea in depth, pushing boundaries and exploring new ideas."
  },
  survey: {
    icon: ClipboardList,
    description: "Gather different perspectives",
    longDescription: "Agents will offer their individual perspectives on a topic. These are isolated responses, so each agent will not have access to other agent's responses in this round."
  },
  debate: {
    icon: MessageCircle,
    description: "Analyze different viewpoints",
    longDescription: "Agents will analyze different viewpoints on a topic"
  },
  brainstorm: {
    icon: Lightbulb,
    description: "Generate creative ideas",
    longDescription: "Agents will generate creative ideas on a topic"
  },
  dialogue: {
    icon: Users,
    description: "Focused conversation between agents",
    longDescription: "Agents will have private 1:1 dialogues with other agents"
  },
  critique: {
    icon: FileSearch,
    description: "Get detailed feedback",
    longDescription: "Agents will get detailed feedback on a topic",
    requiresExistingRounds: true
  },
  review: {
    icon: FileText,
    description: "Review previous rounds",
    longDescription: "Agents will review previous rounds on a topic and perform a specific action",
    requiresExistingRounds: true
  },
  understand: {
    icon: BookOpen,
    description: "Refine your request",
    longDescription: "Agents will refine your request on a topic"
  },
  custom: {
    icon: Settings,
    description: "A blank slate",
    longDescription: "Agents will follow only your exact instructions."
  }
} as const;