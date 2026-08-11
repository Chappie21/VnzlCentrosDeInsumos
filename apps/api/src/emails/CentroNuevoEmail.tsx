import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// Plantilla del aviso a moderadores cuando se crea un centro. Estilos inline con los
// tokens de apps/web/app/globals.css (los clientes de correo ignoran <style>/clases).
export type CentroNuevoEmailProps = {
  nombre: string;
  estado: string;
  ciudad: string;
  direccion: string;
  creadoEn: Date | string;
  moderacionUrl: string;
};

const C = {
  surface: "#faf6f0",
  card: "#ffffff",
  brand: "#b83230", // rojo wordmark
  green: "#4a7c59", // botón / acento
  onSurface: "#2e3230",
  variant: "#4a4e4a",
  border: "#c4c8bc",
};

const font =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

const fmtFecha = (d: Date | string) =>
  new Date(d).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export function CentroNuevoEmail({
  nombre,
  estado,
  ciudad,
  direccion,
  creadoEn,
  moderacionUrl,
}: CentroNuevoEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{`Nuevo centro por verificar: ${nombre}`}</Preview>
      <Body style={{ backgroundColor: C.surface, fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>
          <Text
            style={{
              color: C.brand,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              textAlign: "center",
              margin: "0 0 16px",
            }}
          >
            Red Acopio Venezuela
          </Text>

          <Section
            style={{
              backgroundColor: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 24,
            }}
          >
            <Heading
              as="h1"
              style={{ color: C.onSurface, fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}
            >
              Nuevo centro de acopio
            </Heading>
            <Text style={{ color: C.variant, fontSize: 14, margin: "0 0 16px" }}>
              Se registró un centro que está <strong>PENDIENTE</strong> de verificación.
            </Text>

            <Hr style={{ borderColor: C.border, margin: "0 0 16px" }} />

            <Dato etiqueta="Nombre" valor={nombre} />
            <Dato etiqueta="Ubicación" valor={`${ciudad}, ${estado}`} />
            <Dato etiqueta="Dirección" valor={direccion} />
            <Dato etiqueta="Registrado" valor={fmtFecha(creadoEn)} />

            <Button
              href={moderacionUrl}
              style={{
                backgroundColor: C.green,
                color: "#ffffff",
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
                textAlign: "center",
                display: "block",
                borderRadius: 8,
                padding: "12px 0",
                marginTop: 20,
              }}
            >
              Revisar en moderación
            </Button>
          </Section>

          <Text style={{ color: C.variant, fontSize: 12, textAlign: "center", margin: "16px 0 0" }}>
            Recibes este correo porque eres moderador de Red Acopio Venezuela.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Text style={{ fontSize: 14, margin: "0 0 10px", color: C.onSurface }}>
      <span style={{ color: C.variant, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {etiqueta}
      </span>
      <br />
      {valor}
    </Text>
  );
}

export default CentroNuevoEmail;
