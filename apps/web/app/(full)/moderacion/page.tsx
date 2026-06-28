"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../_components";
import {
  API,
  adminLogin,
  getModeracion,
  verificarCentro,
  type CentroModeracion,
} from "../../lib/api";

const TOKEN_KEY = "acopio-admin-token";

function distancia(m: number | null): string | null {
  if (m == null) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
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
          className="flex h-12 items-center justify-center rounded-lg bg-emergency font-semibold text-white disabled:opacity-50"
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
              <div>
                <span className="font-semibold text-on-surface">Geo de registro: </span>
                {c.geoLat != null && c.geoLng != null ? (
                  <a
                    className="text-safety underline"
                    href={`https://www.google.com/maps?q=${c.geoLat},${c.geoLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ver en mapa
                  </a>
                ) : (
                  "no capturada"
                )}
                {dist && (
                  <span className={c.distanciaGeoM! > 2000 ? " text-emergency" : ""}>
                    {" "}· a {dist} de la dirección
                  </span>
                )}
              </div>
            </dl>

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
                className="flex h-11 items-center justify-center gap-1 rounded-lg bg-safety text-sm font-semibold text-white hover:bg-[#1d4ed8]"
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
