import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";
import {
  esCiudadValida,
  esEstadoValido,
  esPaisValido,
  esTelefonoValido,
  parseDocumento,
  PAIS_META,
  type Pais,
} from "@vnzl/paises";

// Validadores cross-field: el valor válido depende del `pais` del MISMO objeto.
// Mismo patrón que ya usaba IsCiudadDeEstado — se lee el hermano con args.object.
// Todos fallan cerrado si `pais` no es válido: el orden de validación entre
// propiedades no está garantizado, así que nunca se asume que `pais` ya pasó.
function paisDe(args: ValidationArguments): Pais | null {
  const pais = (args.object as any)?.pais;
  return esPaisValido(pais) ? pais : null;
}

function crear(
  name: string,
  test: (pais: Pais, value: string, args: ValidationArguments) => boolean,
  mensaje: (pais: Pais | null) => string,
) {
  return (options?: ValidationOptions) =>
    (object: object, propertyName: string) => {
      registerDecorator({
        name,
        target: object.constructor,
        propertyName,
        options,
        validator: {
          validate(value: unknown, args: ValidationArguments) {
            const pais = paisDe(args);
            return (
              pais !== null &&
              typeof value === "string" &&
              test(pais, value, args)
            );
          },
          defaultMessage(args: ValidationArguments) {
            return mensaje(paisDe(args));
          },
        },
      });
    };
}

export const IsDocumentoDePais = crear(
  "isDocumentoDePais",
  (pais, value) => parseDocumento(pais, value).valid,
  (pais) =>
    pais
      ? `Documento de identidad inválido (ej: ${PAIS_META[pais].ejemploDocumento})`
      : "Documento de identidad inválido",
);

export const IsTelefonoDePais = crear(
  "isTelefonoDePais",
  (pais, value) => esTelefonoValido(pais, value),
  (pais) =>
    pais
      ? `Teléfono móvil inválido (ej: ${PAIS_META[pais].ejemploTelefono})`
      : "Teléfono móvil inválido",
);

export const IsEstadoDePais = crear(
  "isEstadoDePais",
  (pais, value) => esEstadoValido(pais, value),
  (pais) =>
    pais ? `${PAIS_META[pais].labelEstado} inválido` : "Estado inválido",
);

// La ciudad debe pertenecer al estado enviado, dentro del país enviado.
export const IsCiudadDeEstado = crear(
  "isCiudadDeEstado",
  (pais, value, args) => {
    const estado = (args.object as any)?.estado;
    return typeof estado === "string" && esCiudadValida(pais, estado, value);
  },
  (pais) =>
    pais
      ? `${PAIS_META[pais].labelCiudad} inválido para el ${PAIS_META[pais].labelEstado.toLowerCase()} seleccionado`
      : "Ciudad inválida para el estado seleccionado",
);
