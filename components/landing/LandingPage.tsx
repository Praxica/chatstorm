import Link from "next/link";
import Image from "next/image";

export function LandingPage() {
  return (
    <div className="bg-[#08041b]">
      {/* Navigation */}
      <nav className="bg-[#08041b] shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 xl:max-w-5xl xl:px-0 border-b border-[#364152]">
          <div className="flex justify-between items-center py-10 pb-4">
            <div className="flex items-center">
              <div className="flex items-center">
                <Image
                  src="/logo_icon.svg"
                  alt="Chatstorm Logo"
                  width={112}
                  height={112}
                  priority
                />
                <span className="font-mono ml-[-20px] tracking-wide text-[1.75rem] font-bold text-white">CHAT</span>
                <span className="font-mono text-[1.75rem] text-white ml-[2px]">STO</span>
                <span className="font-mono text-[1.75rem] text-white ml-[1px]">R</span>
                <span className="font-mono text-[1.75rem] text-white ml-[3px]">M</span>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <Link 
                href="/sign-in" 
                className="pt-1 text-white hover:text-[#f7339a] m-1 font-medium font-mono uppercase pb-1 border-b-2 hover:border-[#f7339a] transition-colors border-[#f7339a] text-base leading-6 flex items-center"
              >
                Sign in
              </Link>
              <Link 
                href="/sign-up" 
                className="pt-1 text-white hover:text-[#f7339a] m-1 font-medium font-mono uppercase pb-1 border-b-2 hover:border-[#f7339a] transition-colors border-[#f7339a] text-base leading-6 flex items-center"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-[#08041b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h2 className="text-4xl font-bold text-white mb-6 font-mono tracking-wide">
            The future of intelligence is social
          </h2>
          <p className="text-lg text-gray-300 mb-8 max-w-3xl mx-auto">
            Chatstorm is a <strong className="text-white">multi-agent chat platform</strong> for creating socially driven interactions between LLM personas.
            Perfect for complex problem-solving, creative brainstorming, and collaborative AI workflows.
          </p>
          <div className="flex justify-center space-x-4">
            <Link 
              href="/sign-up" 
              className="inline-flex items-center px-8 py-4 border-2 border-[#a0eff7] text-[#a0eff7] hover:bg-[#a0eff7] hover:text-[#08041b] font-mono font-medium transition-colors rounded-md text-lg"
            >
              Start Free
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 xl:max-w-5xl xl:px-0">
          <h3 className="text-4xl font-bold text-center text-[#08041b] mb-12 font-mono tracking-wide">
            Why Chatstorm?
          </h3>
          <div className="grid grid-cols-3 gap-12">
            <div className="flex flex-col">
              <div className="bg-[#08041b]/5 rounded-lg aspect-[4/5] overflow-hidden border border-black mb-4">
                <Image
                  src="/features/features_agent_config.png"
                  alt="Multiple AI Agents"
                  width={400}
                  height={675}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <h4 className="text-xl font-semibold mt-2 mb-1 text-[#08041b] font-mono">Multiple AI Agents</h4>
              <p className="text-gray-600">
                Create conversations with multiple specialized AI agents, each with their own expertise and perspective.
              </p>
            </div>
            <div className="flex flex-col">
              <div className="bg-[#08041b]/5 rounded-lg aspect-[4/5] overflow-hidden border border-black mb-4">
                <Image
                  src="/features/features_config_brainstorm.png"
                  alt="Structured Collaboration"
                  width={400}
                  height={675}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <h4 className="text-xl font-semibold mt-2 mb-1 text-[#08041b] font-mono">Structured Collaboration</h4>
              <p className="text-gray-600">
                Configure conversations for coordinated behavior: agents can brainstorm, debate, criticize, vote, summarize, rank, moderate, and more.
              </p>
            </div>
            <div className="flex flex-col">
              <div className="bg-[#08041b]/5 rounded-lg aspect-[4/5] overflow-hidden border border-black mb-4">
                <Image
                  src="/features/features_config_options.png"
                  alt="Social Interactions"
                  width={400}
                  height={675}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <h4 className="text-xl font-semibold mt-2 mb-1 text-[#08041b] font-mono">Social Interactions</h4>
              <p className="text-gray-600">
                Instruct agents for social behaviors: ask each other questions, make private reflections, and reference historical contributions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Examples Section */}
      <section className="py-24 bg-[#08041b]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 xl:max-w-5xl xl:px-0">
          <h3 className="text-4xl font-bold text-center text-white mb-6 font-mono tracking-wide">
            What can you build with Chatstorm?
          </h3>
          <p className="font-lg text-gray-300 text-center mb-16">Below are just a few examples of the infinite possibilities Chatstorm is designed to enable.</p>
          <div className="space-y-24">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="w-full md:w-2/3">
                <div className="bg-white/5 rounded-lg aspect-video overflow-hidden">
                  <Image
                    src="/templates/innovation_accelerator.png"
                    alt="Innovation Accelerator Example"
                    width={1200}
                    height={675}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
              </div>
              <div className="w-full md:w-1/3 space-y-4">
                <h4 className="text-2xl font-semibold text-white font-mono">Innovation Accelerator</h4>
                <p className="text-gray-300">
                  Create a collaborative writing environment where multiple AI agents act as editors, critics, and creative partners. Perfect for developing stories, scripts, or content with diverse perspectives.
                </p>
                <div className="flex gap-4">
                  <Link 
                    href="/preview/5347c768-9b08-485d-9454-f7530bbce311" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border-2 border-[#a0eff7] text-[#a0eff7] hover:bg-[#a0eff7] hover:text-[#08041b] font-mono font-medium transition-colors rounded-md text-sm"
                  >
                    VIEW EXAMPLE
                  </Link>
                  {/* <Link 
                    href="/chat/5347c768-9b08-485d-9454-f7530bbce311" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border-2 border-[#f7339a] text-[#f7339a] hover:bg-[#f7339a] hover:text-white font-mono font-medium transition-colors rounded-md text-sm"
                  >
                    TRY CHAT
                  </Link> */}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="w-full md:w-2/3">
                <div className="bg-white/5 rounded-lg aspect-video overflow-hidden">
                  <Image
                    src="/templates/public_goods.png"
                    alt="Code Review Example"
                    width={1200}
                    height={675}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
              </div>
              <div className="w-full md:w-1/3 space-y-4">
                <h4 className="text-2xl font-semibold text-white font-mono">Public Goods Game</h4>
                <p className="text-gray-300">
                  Use a public goods game to experiment with how different personalies will act towards a common goal that requires trust to cooperation to maximize success.
                </p>
                <div className="flex gap-4">
                  <Link 
                    href="/preview/c1ae8c63-084a-4ea2-872e-ec544f1d555a" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border-2 border-[#a0eff7] text-[#a0eff7] hover:bg-[#a0eff7] hover:text-[#08041b] font-mono font-medium transition-colors rounded-md text-sm"
                  >
                    VIEW EXAMPLE
                  </Link>
                  {/* <Link 
                    href="/chat/code-review" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border-2 border-[#f7339a] text-[#f7339a] hover:bg-[#f7339a] hover:text-white font-mono font-medium transition-colors rounded-md text-sm"
                  >
                    TRY CHAT
                  </Link> */}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="w-full md:w-2/3">
                <div className="bg-white/5 rounded-lg aspect-video overflow-hidden">
                  <Image
                    src="/templates/generational_perspectives.png"
                    alt="Research Assistant Example"
                    width={1200}
                    height={675}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
              </div>
              <div className="w-full md:w-1/3 space-y-4">
                <h4 className="text-2xl font-semibold text-white font-mono">Generational Perspective Debate</h4>
                <p className="text-gray-300">
                  Simulate how different generational perspectives might tackle a challenging topic. Agents representing each generation will brainstorm, discuss, and try to resolve the problem in way that every generation can consent to.                </p>
                <div className="flex gap-4">
                  <Link 
                    href="/preview/208d1625-a5d4-4e19-b9a6-ab463c8012b8" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border-2 border-[#a0eff7] text-[#a0eff7] hover:bg-[#a0eff7] hover:text-[#08041b] font-mono font-medium transition-colors rounded-md text-sm"
                  >
                    VIEW EXAMPLE
                  </Link>
                  {/* <Link 
                    href="/chat/research" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border-2 border-[#f7339a] text-[#f7339a] hover:bg-[#f7339a] hover:text-white font-mono font-medium transition-colors rounded-md text-sm"
                  >
                    TRY CHAT
                  </Link> */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#08041b] text-gray-300">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 xl:max-w-5xl xl:px-0">
          <div className="py-16 border-t border-[#364152]">
            <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <h4 className="text-xl font-semibold text-white font-mono">Chatstorm: Multi-Agent AI Collaboration Platform</h4>
                <p className="text-gray-300">
                  Chatstorm is a powerful platform for creating and managing multi-agent AI conversations. Our platform enables seamless collaboration between different AI models, allowing for complex problem-solving, creative brainstorming, and sophisticated workflows. Perfect for developers, researchers, and creative professionals looking to leverage the power of multiple AI agents working together.
                </p>
                <div className="pt-4">
                  <Link 
                    href="/sign-up" 
                    className="inline-flex items-center px-6 py-3 bg-[#f7339a] hover:bg-[#f7339a]/90 text-white font-mono font-medium transition-colors rounded-md"
                  >
                    Get Started
                  </Link>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-xl font-semibold text-white font-mono">Key Features</h4>
                <ul className="space-y-2 text-gray-300">
                  <li>• Multiple AI agents working in concert</li>
                  <li>• Customizable agent personas and roles</li>
                  <li>• Real-time collaboration and feedback</li>
                  <li>• Persistent conversation history</li>
                  <li>• Advanced workflow automation</li>
                  <li>• Secure and private conversations</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="py-12 text-center border-t border-[#364152]">
            <div className="mb-2 flex space-x-2 text-sm py-12">
              <div>© 2025</div>
              <a 
                href="https://praxica.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[#a0eff7] hover:text-white hover:underline transition-colors duration-200"
              >
                Praxica Labs
              </a>
              <div> • </div>
              <a 
                href="mailto:hello@praxica.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[#a0eff7] hover:text-white hover:underline transition-colors duration-200"
              >
                hello@praxica.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 