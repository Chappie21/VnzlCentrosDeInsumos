import { cedulaValidacionVe } from "../../flags";
import RegistroForm from "./_components/RegistroForm";

// Server component fino: el Flags SDK evalúa solo en el servidor, así que el
// valor se resuelve acá y baja como prop al formulario (que es cliente por el
// react-hook-form). Sin NEXT_PUBLIC_*: esa se hornea en build time y haría falta
// un rebuild para mover el interruptor.
export default async function RegistroPage() {
  const portonCedulaVe = await cedulaValidacionVe();
  return <RegistroForm portonCedulaVe={portonCedulaVe} />;
}
