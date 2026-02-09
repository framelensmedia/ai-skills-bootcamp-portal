import Link from "next/link";

export default function TermsPage() {
    return (
        <div className="mx-auto max-w-4xl px-4 py-16 text-white/80">
            <Link href="/" className="text-sm text-[#B7FF00] hover:underline mb-8 block">← Back to Home</Link>

            <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>

            <div className="space-y-6 leading-relaxed">
                <p>Last updated: {new Date().toLocaleDateString()}</p>

                <p>
                    Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the AI Skills Studio website operated by us.
                </p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">Conditions of Use</h2>
                <p>
                    By accessing this website, you agree to be bound by these website Terms and Conditions of Use, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws.
                </p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">License</h2>
                <p>
                    Permission is granted to temporarily download one copy of the materials (information or software) on AI Skills Studio's website for personal, non-commercial transitory viewing only.
                </p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">Disclaimer</h2>
                <p>
                    The materials on AI Skills Studio's website are provided "as is". AI Skills Studio makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties, including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
                </p>

                <p className="mt-8 text-sm opacity-60">
                    [Full Terms of Service details to be populated]
                </p>
            </div>
        </div>
    );
}
