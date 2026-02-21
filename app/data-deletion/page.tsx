import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Data Deletion Instructions | Social Share',
    description: 'Instructions on how to remove your data from our application.',
};

export default function DataDeletionPage() {
    return (
        <div className="min-h-screen bg-black text-white px-6 py-24 md:py-32">
            <div className="mx-auto max-w-3xl">
                <Link href="/" className="inline-flex items-center text-sm font-medium text-white/50 hover:text-white mb-8 transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Link>

                <h1 className="text-4xl font-bold tracking-tight text-white mb-8">Data Deletion Instructions</h1>

                <div className="prose prose-invert max-w-none space-y-6 text-zinc-300">
                    <p>
                        Social Share Platform respects your right to privacy and provides a simple way to delete your data from our system.
                        If you have connected your Meta (Facebook/Instagram) account to our platform and wish to remove it, you can do so by following these instructions.
                    </p>

                    <h2 className="text-2xl font-bold text-white mt-12 mb-4">Option 1: Removing Data via Our Platform</h2>
                    <p>The easiest way to remove your connected social accounts is directly through our settings.</p>
                    <ol className="list-decimal pl-5 space-y-2 mt-4">
                        <li>Log in to your account on our platform.</li>
                        <li>Navigate to the <strong>Settings</strong> page.</li>
                        <li>Scroll down to the <strong>Connected Accounts</strong> section.</li>
                        <li>If you have a Meta account connected, you can click the option to disconnect or remove it.</li>
                        <li>Upon removal, we immediately delete your access tokens and stored account IDs from our active database.</li>
                    </ol>

                    <h2 className="text-2xl font-bold text-white mt-12 mb-4">Option 2: Removing Data via Facebook</h2>
                    <p>You can also remove our app's access directly from your Facebook privacy settings, which will trigger a data deletion request to us.</p>
                    <ol className="list-decimal pl-5 space-y-2 mt-4">
                        <li>Go to your Facebook account's <strong>Settings & Privacy</strong> menu.</li>
                        <li>Click on <strong>Settings</strong>.</li>
                        <li>Look for <strong>Apps and Websites</strong> and you will see all the apps and websites you linked with your Facebook.</li>
                        <li>Search for our application in the list.</li>
                        <li>Click the <strong>Remove</strong> button.</li>
                        <li>Congratulations, you have successfully removed your app activities.</li>
                    </ol>

                    <h2 className="text-2xl font-bold text-white mt-12 mb-4">Full Account Deletion</h2>
                    <p>
                        If you wish to delete your entire account along with all associated data (including generated images, videos, and associated social accounts),
                        please contact our support team or use the account deletion option in your profile settings (if available).
                    </p>

                    <div className="mt-12 p-6 bg-white/5 rounded-xl border border-white/10">
                        <h3 className="text-lg font-bold text-white mb-2">Need Help?</h3>
                        <p className="text-sm">
                            If you have any questions or need assistance with deleting your data, please contact us.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
