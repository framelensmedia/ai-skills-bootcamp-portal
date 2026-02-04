import { Hourglass } from "lucide-react";

export default function LoadingHourglass({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <div className="animate-spin duration-3000 ease-in-out">
            <Hourglass className={className} />
        </div>
    );
}
