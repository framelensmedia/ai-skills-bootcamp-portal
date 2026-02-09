import Link from "next/link";

export default function PrivacyPage() {
    return (
        <div className="mx-auto max-w-4xl px-4 py-16 text-white/80">
            <Link href="/" className="text-sm text-[#B7FF00] hover:underline mb-8 block">← Back to Home</Link>

            <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>

            <div className="space-y-6 leading-relaxed">
                <p>Last updated: {new Date().toLocaleDateString()}</p>

                <p>
                    At AI Skills Studio, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclosure, and safeguard your information when you visit our website.
                </p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">Information We Collect</h2>
                <p>
                    We collect information that you voluntarily provide to us when you register on the website, express an interest in obtaining information about us or our products and services, when you participate in activities on the website, or otherwise when you contact us.
                </p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">Use of Your Information</h2>
                <p>
                    Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the website to:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Create and manage your account.</li>
                    <li>Process your subscription and payments.</li>
                    <li>Email you regarding your account or order.</li>
                    <li>Fulfil and manage purchases, orders, payments, and other transactions related to the website.</li>
                </ul>

                <p className="mt-8 text-sm opacity-60">
                    [Full Privacy Policy details to be populated]
                </p>
            </div>
        </div>
    );
}
