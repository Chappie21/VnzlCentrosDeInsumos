"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState, Fab } from "../../_components";
import {
  useCentros,
  useDebouncedValue,
  useGeolocation,
} from "../../_hooks";
import { requireHelp } from "../../lib/identity";
import {
  FILTERS,
  ROUTES,
  DEBOUNCE_MS,
  GEO_PRECISION,
  type FilterId,
} from "../../constants";
import { CentroCard, FilterChips, SearchBar } from "./_components";

const round = (n: number) => Number(n.toFixed(GEO_PRECISION));

export default function DirectorioCentros() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, DEBOUNCE_MS);
  const [active, setActive] = useState<Record<FilterId, boolean>>({
    [FILTERS.cerca]: false,
    [FILTERS.abiertos]: false,
    [FILTERS.urgencia]: false,
    [FILTERS.verificado]: false,
  });

  // Pide GPS al montar. Si hay coords, mostramos distancias siempre; el chip "Cerca de mí" filtra a 5km.
  const { coords, request } = useGeolocation();
  useEffect(() => request(), [request]);

  function toggle(id: FilterId) {
    setActive((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // lat/lng siempre que haya coords (GPS aceptado); redondeadas (anti-jitter).
  const filters = useMemo(
    () => ({
      q: debouncedQ.trim(),
      soloAbiertos: active[FILTERS.abiertos],
      urgenciaAlta: active[FILTERS.urgencia],
      verificado: active[FILTERS.verificado],
      lat: coords ? round(coords.lat) : null,
      lng: coords ? round(coords.lng) : null,
      cerca: active[FILTERS.cerca] && coords != null,
    }),
    [debouncedQ, active, coords],
  );

  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useCentros(filters);

  const centros = data?.pages.flatMap((p) => p.items) ?? [];

  // Scroll infinito: observa un sentinel al final de la lista.
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      <section className="sticky top-12 z-30 -mx-4 bg-surface px-4 py-4">
        <SearchBar value={q} onChange={setQ} />
        <div className="mt-4">
          <FilterChips active={active} onToggle={toggle} />
        </div>
      </section>

      <section className="mt-2 flex flex-col gap-4">
        {centros.map((c) => (
          <CentroCard key={c.id} centro={c} />
        ))}

        {centros.length === 0 &&
          (isLoading ? (
            <p className="py-8 text-center text-on-surface-variant">Cargando…</p>
          ) : isError ? (
            <EmptyState
              icon="error"
              title="No se pudo cargar el directorio"
              subtitle="Revisá tu conexión e intentá de nuevo."
            />
          ) : (
            <EmptyState
              icon="search_off"
              title="Sin resultados"
              subtitle="Probá con otra búsqueda o quitá filtros."
            />
          ))}

        <div ref={sentinel} />
        {isFetchingNextPage && (
          <p className="py-4 text-center text-sm text-on-surface-variant">
            Cargando más…
          </p>
        )}
      </section>

      <Fab
        icon="add"
        label="Agregar centro de acopio"
        onClick={() =>
          requireHelp(router, ROUTES.crearCentro, () =>
            router.push(ROUTES.crearCentro),
          )
        }
      />
    </>
  );
}
