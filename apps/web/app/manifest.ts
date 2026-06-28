import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_DESCRIPTION, THEME_COLOR } from "./constants/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Red Acopio",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: THEME_COLOR,
    lang: "es",
    icons: [{ src: "/icon.svg", type: "image/svg+xml", sizes: "any" }],
  };
}
