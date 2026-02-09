import Link from "next/link";
import { Users, MessageSquare, Award } from "lucide-react";

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-white/80">
      <Link href="/" className="text-sm text-[#B7FF00] hover:underline mb-8 block">← Back to Home</Link>

      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Join the Community</h1>
        <p className="text-xl text-white/60 max-w-2xl mx-auto">
          Connect with thousands of creators, share your work, and get feedback on your AI projects.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="text-center p-6 rounded-2xl border border-white/10 bg-white/5">
          <div className="mx-auto bg-[#B7FF00]/10 h-16 w-16 rounded-full flex items-center justify-center text-[#B7FF00] mb-6">
            <Users size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Discord Server</h3>
          <p className="text-sm opacity-70 mb-6">Real-time chat, live events, and instant feedback.</p>
          <button className="w-full py-2 rounded-lg bg-[#5865F2] text-white font-semibold hover:opacity-90 transition-opacity">
            Join Discord
          </button>
        </div>

        <div className="text-center p-6 rounded-2xl border border-white/10 bg-white/5">
          <div className="mx-auto bg-pink-500/10 h-16 w-16 rounded-full flex items-center justify-center text-pink-500 mb-6">
            <MessageSquare size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Forum</h3>
          <p className="text-sm opacity-70 mb-6">Deep dive discussions, tutorials, and show-and-tell.</p>
          <button className="w-full py-2 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-white font-semibold">
            Visit Forum
          </button>
        </div>

        <div className="text-center p-6 rounded-2xl border border-white/10 bg-white/5">
          <div className="mx-auto bg-purple-500/10 h-16 w-16 rounded-full flex items-center justify-center text-purple-500 mb-6">
            <Award size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Weekly Challenges</h3>
          <p className="text-sm opacity-70 mb-6">Compete for prizes and recognition in our weekly prompts.</p>
          <button className="w-full py-2 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-white font-semibold">
            View Challenges
          </button>
        </div>
      </div>
    </div>
  );
}
