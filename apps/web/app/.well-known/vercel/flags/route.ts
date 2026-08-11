import { createFlagsDiscoveryEndpoint, getProviderData } from "flags/next";
import * as flags from "../../../../flags";

// Endpoint de descubrimiento del Flags Explorer (barra de herramientas de
// Vercel): lista los flags declarados y permite overridearlos por sesión sin
// tocar código. Protegido por FLAGS_SECRET.
export const GET = createFlagsDiscoveryEndpoint(async () => getProviderData(flags));
