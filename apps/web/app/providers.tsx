"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Solo lo que de verdad es global. El provider de Google vive en GoogleButton,
// que lo carga bajo demanda en /login y /registro (ver _components/GoogleAuthProvider).
export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
