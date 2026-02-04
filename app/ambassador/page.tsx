import { Suspense } from "react";
import AmbassadorClient from "./AmbassadorClient";

export default function AmbassadorPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
            <AmbassadorClient
                initialUser={null}
                initialProfile={null}
                initialAmbassador={null}
                initialStats={null}
            />
        </Suspense>
    );
}
