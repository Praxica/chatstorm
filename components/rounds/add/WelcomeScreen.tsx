'use client'

import { Button } from '@/components/ui/button'

interface WelcomeScreenProps {
  onDismiss: () => void
}

export function WelcomeScreen({ onDismiss }: WelcomeScreenProps) {
  return (
    <div className="absolute inset-0 bg-white z-50 flex items-center justify-center p-5">
      <div className="w-full max-w-2xl overflow-auto" style={{ maxHeight: 'calc(100vh - 40px)' }}>
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">Welcome to ChatStorm! 👋</h2>
            <p className="text-gray-600">Get started by understanding two key concepts</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-8">
            {/* Agents explanation */}
            <div className="border border-gray-200 bg-gray-50 rounded-lg p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold">Agents</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Agents are the AI participants in your conversation.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed font-bold">
                Use agent prompts to set the agent&apos;s personality, expertise, and perspective.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Agents can represent roles like <em>Product Manager</em>, personas like <em>Wise Elder</em>, or specific people like <em>Ben Franklin</em>.
              </p>
            </div>

            {/* Rounds explanation */}
            <div className="border border-gray-200 bg-gray-50 rounded-lg p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold">Rounds</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Rounds structure how agents participate in the conversation. 
              </p>
              <p className="text-sm text-gray-600 leading-relaxed font-bold">
                Use round prompts to shape agent tasks and interactions.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                For example, agents can generate a list of ideas in a <em>brainstorm</em> round and then rank them in a <em>review</em> round.
              </p>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <Button
              onClick={onDismiss}
              size="lg"
              className="px-8"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
