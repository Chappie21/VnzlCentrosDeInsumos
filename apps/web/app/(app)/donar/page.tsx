"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "../../constants";
import { hasFullIdentity, syncIdentity } from "../../lib/identity";
import DonacionForm from "./_components/DonacionForm";

// Donar exige identidad (igual que ayudar). Si no la hay ni en localStorage ni en
// el backend, manda al onboarding con `next` de vuelta a donar.
export default function DonarPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
      if (hasFullIdentity() || (await syncIdentity())) {
        setOk(true);
        return;
      }
      router.replace(`/?next=${encodeURIComponent(ROUTES.donar)}`);
    })();
  }, [router]);

  if (!ok) return null;
  return <DonacionForm />;
}
