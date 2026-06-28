// Estados/municipios viven en el paquete compartido @vnzl/venezuela (lo usa
// también la API para validar). Se re-exporta acá para no romper imports
// existentes desde "../constants".
export { VENEZUELA, ESTADOS, municipiosDe, esEstadoValido, esCiudadValida } from "@vnzl/venezuela";
