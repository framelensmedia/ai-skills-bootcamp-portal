import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "AI Skills Studio",
        short_name: "AI Skills",
        description: "Launch your business with AI",
        start_url: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
            {
                src: "/logo-symbol.png",
                sizes: "any",
                type: "image/png",
            },
        ],
    };
}
