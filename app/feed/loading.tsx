export default function FeedLoading() {
    return (
        <div className="w-full">
            {/* Filter Bar Skeleton */}
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="h-10 w-48 animate-pulse rounded-xl bg-white/5" />
                <div className="flex gap-2">
                    <div className="h-10 w-24 animate-pulse rounded-xl bg-white/5" />
                    <div className="h-10 w-24 animate-pulse rounded-xl bg-white/5" />
                </div>
            </div>

            {/* Masonry Grid Skeleton */}
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
                {[...Array(12)].map((_, i) => (
                    <div key={i} className="mb-4 break-inside-avoid">
                        <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/5 p-3">
                            {/* Header */}
                            <div className="mb-3 flex items-center gap-2">
                                <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
                                <div className="flex flex-col gap-1">
                                    <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                                    <div className="h-2 w-16 animate-pulse rounded bg-white/10" />
                                </div>
                            </div>

                            {/* Image Placeholder - varying heights for masonry feel */}
                            <div
                                className="mb-3 w-full animate-pulse rounded-lg bg-white/10"
                                style={{ height: `${[260, 320, 200, 380][i % 4]}px` }}
                            />

                            {/* Footer Actions */}
                            <div className="flex items-center justify-between">
                                <div className="h-8 w-16 animate-pulse rounded-lg bg-white/10" />
                                <div className="h-8 w-8 animate-pulse rounded-lg bg-white/10" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
