import DonacionForm from "./_components/DonacionForm";

// Donar NO requiere autenticación: el QR de donación se genera en el cliente,
// así que cualquiera (incluso anónimo) puede donar. El centro lo escanea al recibir.
export default function DonarPage() {
  return <DonacionForm />;
}
