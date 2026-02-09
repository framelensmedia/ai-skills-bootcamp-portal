import Link from "next/link";
import { Twitter, Instagram, Linkedin, Github } from "lucide-react";

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="border-t border-border bg-background py-12 text-sm text-muted-foreground">
            <div className="mx-auto max-w-6xl px-4 grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                {/* Brand */}
                <div className="col-span-1 md:col-span-1">
                    <Link href="/" className="flex items-center gap-2 mb-4">
                        <div className="h-8 w-8 rounded-lg bg-[#B7FF00]/10 border border-[#B7FF00]/20 flex items-center justify-center text-[#B7FF00] font-bold">
                            AI
                        </div>
                        <span className="font-bold text-foreground text-lg">Skills Studio</span>
                    </Link>
                    <p className="mb-6">
                        Empowering the next generation of creators and entrepreneurs with AI.
                    </p>
                    <div className="flex gap-4">
                        <Link href="#" className="hover:text-foreground transition-colors"><Twitter size={20} /></Link>
                        <Link href="#" className="hover:text-foreground transition-colors"><Instagram size={20} /></Link>
                        <Link href="#" className="hover:text-foreground transition-colors"><Linkedin size={20} /></Link>
                    </div>
                </div>

                {/* Links Column 1 */}
                <div>
                    <h3 className="font-semibold text-foreground mb-4">Platform</h3>
                    <ul className="space-y-3">
                        <li><Link href="/prompts" className="hover:text-[#B7FF00] transition-colors">Prompt Library</Link></li>
                        <li><Link href="/bootcamps" className="hover:text-[#B7FF00] transition-colors">Bootcamps</Link></li>
                        <li><Link href="/studio/creator" className="hover:text-[#B7FF00] transition-colors">Creator Studio</Link></li>
                        <li><Link href="/pricing" className="hover:text-[#B7FF00] transition-colors">Pricing</Link></li>
                    </ul>
                </div>

                {/* Links Column 2 */}
                <div>
                    <h3 className="font-semibold text-foreground mb-4">Resources</h3>
                    <ul className="space-y-3">
                        <li><Link href="/blog" className="hover:text-[#B7FF00] transition-colors">Blog</Link></li>
                        <li><Link href="/help" className="hover:text-[#B7FF00] transition-colors">Help Center</Link></li>
                        <li><Link href="/community" className="hover:text-[#B7FF00] transition-colors">Community</Link></li>
                        <li><Link href="/login" className="hover:text-[#B7FF00] transition-colors">Log In</Link></li>
                    </ul>
                </div>

                {/* Legal */}
                <div>
                    <h3 className="font-semibold text-foreground mb-4">Legal</h3>
                    <ul className="space-y-3">
                        <li><Link href="/privacy" className="hover:text-[#B7FF00] transition-colors">Privacy Policy</Link></li>
                        <li><Link href="/terms" className="hover:text-[#B7FF00] transition-colors">Terms of Service</Link></li>
                        <li><Link href="#" className="hover:text-[#B7FF00] transition-colors">Cookie Policy</Link></li>
                    </ul>
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-4 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    &copy; {currentYear} AI Skills Studio. All rights reserved.
                </div>
                <div className="flex gap-6">
                    {/* Additional bottom links if needed */}
                </div>
            </div>
        </footer>
    );
}
