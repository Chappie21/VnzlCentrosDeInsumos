import type { Metadata } from "next";
import { Icon } from "../../_components";

export const metadata: Metadata = {
  title: "Ayuda y preguntas frecuentes",
  description:
    "Cómo usar Red Acopio Venezuela: registro, buscar centros, donar, crear y administrar un centro, voluntarios e inventario.",
};

// Contenido del FAQ (español neutro). Derivado de los flujos reales de la app.
// ponytail: contenido estático en datos + <details> nativo (sin JS ni librerías).
const SECCIONES: { titulo: string; icono: string; qa: { q: string; a: string }[] }[] = [
  {
    titulo: "Sobre la aplicación",
    icono: "info",
    qa: [
      {
        q: "¿Qué es esta aplicación?",
        a: "Es una red de centros de acopio para donaciones de emergencia en Venezuela. Te permite encontrar centros cercanos, ver qué insumos necesitan, donar, y crear o administrar tu propio centro.",
      },
      {
        q: "¿Necesito registrarme para usarla?",
        a: "No para mirar. Puedes ver el directorio, el mapa y el detalle de cada centro de forma anónima. Para contribuir (donar, crear o administrar un centro) sí debes registrarte.",
      },
      { q: "¿Tiene costo?", a: "No, el uso de la aplicación es gratuito." },
    ],
  },
  {
    titulo: "Registro e identidad",
    icono: "badge",
    qa: [
      {
        q: "¿Cómo me registro?",
        a: "En la pantalla de inicio completas tu nombre, cédula y teléfono. Con esos datos ya puedes contribuir.",
      },
      {
        q: "¿Puedo usar la aplicación sin dar mis datos?",
        a: "Sí. Con la opción “Solo quiero observar” entras de forma anónima y tienes acceso de solo lectura al directorio y al mapa.",
      },
      {
        q: "¿Para qué piden mi cédula?",
        a: "Para dar confianza a la red. Al crear tu primer centro, la cédula se verifica contra el registro oficial.",
      },
      {
        q: "¿Cuál es la diferencia entre observar, ayudar y donar?",
        a: "Observar es solo ver la información. Ayudar te permite crear y administrar centros y registrar donaciones. Donar genera un código para entregar insumos en un centro.",
      },
    ],
  },
  {
    titulo: "Buscar centros",
    icono: "search",
    qa: [
      {
        q: "¿Cómo encuentro un centro cerca de mí?",
        a: "En la pestaña “Centros” activa el filtro “Cerca de mí”. La aplicación pedirá tu ubicación y mostrará los centros que están a 5 km a la redonda.",
      },
      {
        q: "¿Qué significan los filtros?",
        a: "“Cerca de mí” muestra los que están a 5 km. “Solo abiertos” muestra los que están recibiendo ahora. “Urgencia alta” muestra los que tienen insumos urgentes. “Verificados” muestra los revisados por el equipo.",
      },
      {
        q: "¿Para qué sirve el Mapa?",
        a: "Para ver todos los centros ubicados geográficamente. Al tocar un marcador vas directo al detalle de ese centro.",
      },
      {
        q: "¿Qué información veo en el detalle de un centro?",
        a: "La dirección, si está abierto o cerrado, sus necesidades con cantidades, el número de voluntarios y un botón “Cómo llegar” que abre el mapa de navegación.",
      },
    ],
  },
  {
    titulo: "Donar insumos",
    icono: "volunteer_activism",
    qa: [
      {
        q: "¿Cómo dono insumos?",
        a: "Elige la opción “Quiero Donar”, selecciona los insumos y sus cantidades, y la aplicación generará un código QR con tu donación.",
      },
      {
        q: "¿Qué hago con el código QR?",
        a: "Llévalo al centro de acopio y muéstralo. Un voluntario lo escanea y registra tu donación en el inventario.",
      },
      {
        q: "¿Puedo elegir a qué centro llevar mi donación?",
        a: "Sí. Revisa el directorio o el mapa y lleva tu donación al centro que más lo necesite.",
      },
    ],
  },
  {
    titulo: "Crear y administrar un centro",
    icono: "add_business",
    qa: [
      {
        q: "¿Cómo creo un centro de acopio?",
        a: "Usa “Agregar centro”. Completas los datos (nombre, estado, ciudad y dirección), marcas la ubicación en el mapa y, si quieres, cargas el inventario inicial.",
      },
      {
        q: "¿Puedo cargar el inventario que ya tengo?",
        a: "Sí. Puedes agregar los insumos manualmente o importarlos desde un archivo de Excel.",
      },
      {
        q: "¿Qué significa ser “jefe” de un centro?",
        a: "El jefe es quien crea el centro. Puede editar sus datos, invitar y gestionar voluntarios, ajustar el inventario y descargar el reporte.",
      },
      {
        q: "¿Cómo edito los datos o la foto del centro?",
        a: "Desde el panel del centro, en la opción “Editar”. Solo el jefe puede hacerlo.",
      },
      {
        q: "¿Cómo indico que el centro está abierto o cerrado?",
        a: "Con el interruptor de estado operativo en el panel del centro. Eso actualiza el filtro “Solo abiertos” del directorio.",
      },
    ],
  },
  {
    titulo: "Voluntarios",
    icono: "groups",
    qa: [
      {
        q: "¿Cómo invito voluntarios a mi centro?",
        a: "En el panel del centro usa “Invitar voluntarios”. Se genera un enlace y un código QR válidos por 1 hora para compartir.",
      },
      {
        q: "¿Cómo me uno a un centro?",
        a: "Abre el enlace o escanea el código QR de la invitación. Si todavía no estás registrado, primero completas tus datos y luego quedas unido.",
      },
      {
        q: "¿Qué puede hacer un voluntario?",
        a: "Registrar donaciones, cambiar el estado operativo del centro y ver el inventario. No puede editar los datos del centro ni gestionar a otros voluntarios.",
      },
      {
        q: "¿Cómo quito a un voluntario?",
        a: "El jefe lo hace desde “Gestionar voluntarios”. El jefe no puede ser removido.",
      },
    ],
  },
  {
    titulo: "Inventario, donaciones y envíos",
    icono: "inventory_2",
    qa: [
      {
        q: "¿Cómo registro una donación que llega al centro?",
        a: "Usa “Escanear”. Eliges el centro, escaneas el código QR del donante y confirmas los insumos recibidos.",
      },
      {
        q: "¿Cómo corrijo el inventario si hay un error?",
        a: "El jefe puede hacer un ajuste manual (sumar o restar) sobre cada insumo del inventario.",
      },
      {
        q: "¿Cómo envío insumos a otro centro?",
        a: "Usa “Nuevo Envío”. Eliges el destino (otro centro de la red o un lugar libre), los insumos y el transporte. Se genera una guía con código QR.",
      },
      {
        q: "¿Qué es la guía de envío?",
        a: "Es un comprobante público del despacho (origen, destino e insumos) al que se accede con su código QR. No requiere iniciar sesión.",
      },
      {
        q: "¿Por qué no puedo cambiar la cantidad directamente?",
        a: "El total siempre se modifica a través de registros (donación, carga inicial, ajuste o salida). Así queda trazabilidad de cada movimiento.",
      },
    ],
  },
  {
    titulo: "Verificación de centros",
    icono: "verified",
    qa: [
      {
        q: "¿Qué significa que un centro esté “verificado”?",
        a: "Que el equipo de moderación revisó sus datos (foto, ubicación y responsable). Puedes filtrar por “Verificados” en el directorio.",
      },
      {
        q: "¿Cómo se verifica mi centro?",
        a: "El equipo de moderación lo revisa después de creado. No necesitas hacer nada adicional.",
      },
    ],
  },
  {
    titulo: "Reportes y privacidad",
    icono: "lock",
    qa: [
      {
        q: "¿Cómo descargo un reporte del inventario?",
        a: "El jefe usa “Descargar reporte PDF” en el panel del centro. Genera un documento imprimible con el inventario.",
      },
      {
        q: "¿Quién puede ver mis datos personales?",
        a: "Tus datos de contacto solo los ve el jefe de tu centro y el equipo de moderación. El directorio público nunca muestra información personal.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-on-surface">Ayuda y preguntas frecuentes</h1>
        <p className="mt-1 text-on-surface-variant">
          Cómo funciona Red Acopio Venezuela y qué puedes hacer según tu rol.
        </p>
      </header>

      <div className="flex flex-col gap-8">
        {SECCIONES.map((sec) => (
          <section key={sec.titulo}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-on-surface-variant">
              <Icon name={sec.icono} className="text-[18px]" />
              {sec.titulo}
            </h2>
            <div className="flex flex-col gap-2">
              {sec.qa.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-lg border border-outline-variant bg-surface-container-lowest"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 font-medium text-on-surface marker:content-none">
                    {item.q}
                    <Icon
                      name="expand_more"
                      className="shrink-0 text-on-surface-variant transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <p className="border-t border-outline-variant px-4 py-3 text-on-surface-variant">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
