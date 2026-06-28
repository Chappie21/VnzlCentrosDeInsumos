"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "../../_components";
import {
  API,
  adminLogin,
  getModeracion,
  verificarCentro,
  type CentroModeracion,
} from "../../lib/api";

// Leaflet usa window → solo en cliente.
const MiniMapa = dynamic(() => import("./_components/MiniMapa"), { ssr: false });

const TOKEN_KEY = "acopio-admin-token";

function distancia(m: number | null): string | null {
  if (m == null) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

// ¿El nombre cargado coincide con el del registro de cédula? Tolerante a orden/acentos.
function nombreCoincide(a: string | null, b: string | null): boolean | null {
  if (!a || !b) return null;
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const ta = norm(a).split(/\s+/).filter((t) => t.length >= 3);
  const tb = new Set(norm(b).split(/\s+/).filter(Boolean));
  if (!ta.length) return null;
  const hits = ta.filter((t) => tb.has(t)).length;
  return hits >= Math.ceil(ta.length / 2);
}

export default function Moderacion() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [items, setItems] = useState<CentroModeracion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (t: string) => {
    setCargando(true);
    setError(null);
    try {
      setItems(await getModeracion(t, "PENDIENTE"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      setError(msg);
      setItems(null);
      if (/inválid|expirad|sesión/i.test(msg)) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
    } finally {
      setCargando(false);
    }
  }, []);

  async function login() {
    setEntrando(true);
    setError(null);
    try {
      const { token: t } = await adminLogin(email.trim(), password);
      localStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión");
    } finally {
      setEntrando(false);
    }
  }

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    if (token) cargar(token);
  }, [token, cargar]);

  async function decidir(id: string, estado: "VERIFICADO" | "RECHAZADO") {
    if (!token) return;
    try {
      await verificarCentro(token, id, estado);
      setItems((prev) => prev?.filter((c) => c.id !== id) ?? null);
    } catch {
      setError("No se pudo actualizar. Reintentá.");
    }
  }

  // --- Login gate (sesión de moderador) ---
  if (!token) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          login();
        }}
        className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4"
      >
        <h1 className="text-2xl font-bold text-on-surface">Moderación</h1>
        <p className="text-on-surface-variant">Iniciá sesión para verificar centros.</p>
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="h-12 rounded-lg border-2 border-outline-variant bg-surface px-3 text-on-surface focus:border-safety focus:outline-none"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="h-12 rounded-lg border-2 border-outline-variant bg-surface px-3 text-on-surface focus:border-safety focus:outline-none"
        />
        {error && <p className="text-sm text-emergency">{error}</p>}
        <button
          type="submit"
          disabled={!email.trim() || !password || entrando}
          className="flex h-12 items-center justify-center rounded-lg bg-action font-semibold text-white transition-colors hover:bg-[#5a4a26] disabled:opacity-50"
        >
          {entrando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    );
  }

  // --- Lista ---
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-surface">Centros pendientes</h1>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
            setItems(null);
          }}
          className="text-sm text-on-surface-variant underline"
        >
          Salir
        </button>
      </div>

      {error && <p className="text-sm text-emergency">{error}</p>}
      {cargando && <p className="py-8 text-center text-on-surface-variant">Cargando…</p>}
      {items && items.length === 0 && !cargando && (
        <p className="py-8 text-center text-on-surface-variant">No hay centros pendientes. 🎉</p>
      )}

      {items?.map((c) => {
        const dist = distancia(c.distanciaGeoM);
        // Punto a mapear: la geo de registro (evidencia) o, si no, la dirección declarada.
        const punto =
          c.geoLat != null && c.geoLng != null
            ? { lat: c.geoLat, lng: c.geoLng, tipo: "Geo de registro" }
            : c.latitud != null && c.longitud != null
              ? { lat: c.latitud, lng: c.longitud, tipo: "Dirección" }
              : null;
        const ced = c.responsable?.cedulaVerificada ?? null;
        const cedMatch = nombreCoincide(c.responsable?.nombre ?? null, c.responsable?.cedulaNombre ?? null);
        return (
          <article
            key={c.id}
            className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
          >
            <div>
              <h2 className="text-lg font-semibold text-on-surface">{c.nombre}</h2>
              <p className="text-sm text-on-surface-variant">
                {c.direccion} · {c.ciudad}, {c.estado}
              </p>
            </div>

            {c.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${API}${c.fotoUrl}`}
                alt="Local"
                className="h-40 w-full rounded-lg border border-outline-variant object-cover"
              />
            ) : (
              <p className="text-xs italic text-on-surface-variant">Sin foto del local</p>
            )}

            <dl className="space-y-1 text-sm text-on-surface-variant">
              <div>
                <span className="font-semibold text-on-surface">Responsable: </span>
                {c.responsable
                  ? `${c.responsable.nombre ?? "—"} (${c.responsable.cedula ?? "s/c"}, ${c.responsable.telefono ?? "s/t"})`
                  : "—"}
              </div>
              {c.responsable && (
                <div>
                  <span className="font-semibold text-on-surface">Cédula: </span>
                  {ced === true && cedMatch === false ? (
                    <span className="text-emergency">
                      ⚠️ existe pero el nombre no coincide — registro: {c.responsable.cedulaNombre}
                    </span>
                  ) : ced === true ? (
                    <span className="text-safety">
                      ✓ verificada{c.responsable.cedulaNombre ? ` — ${c.responsable.cedulaNombre}` : ""}
                    </span>
                  ) : ced === false ? (
                    <span className="text-emergency">⚠️ no encontrada en el registro</span>
                  ) : (
                    <span>sin verificar</span>
                  )}
                </div>
              )}
              {dist && (
                <div>
                  <span className="font-semibold text-on-surface">Distancia: </span>
                  <span className={c.distanciaGeoM! > 2000 ? "text-emergency" : ""}>
                    {dist} entre la geo de registro y la dirección
                  </span>
                </div>
              )}
            </dl>

            {/* Punto exacto en el mapa (evidencia para aprobar/rechazar) */}
            {punto ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  {punto.tipo} · {punto.lat.toFixed(6)}, {punto.lng.toFixed(6)}
                </p>
                <MiniMapa lat={punto.lat} lng={punto.lng} />
                <a
                  href={`https://www.google.com/maps?q=${punto.lat},${punto.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant text-sm font-semibold text-safety transition-colors hover:bg-surface-container"
                >
                  <Icon name="map" />
                  Ver en Google Maps
                </a>
              </div>
            ) : (
              <p className="text-xs italic text-on-surface-variant">Sin coordenadas</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => decidir(c.id, "RECHAZADO")}
                className="flex h-11 items-center justify-center gap-1 rounded-lg border border-outline-variant text-sm font-semibold text-emergency hover:bg-emergency/5"
              >
                <Icon name="gpp_bad" />
                Rechazar
              </button>
              <button
                type="button"
                onClick={() => decidir(c.id, "VERIFICADO")}
                className="flex h-11 items-center justify-center gap-1 rounded-lg bg-safety text-sm font-semibold text-white transition-colors hover:bg-[#3d6649]"
              >
                <Icon name="verified" />
                Verificar
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
