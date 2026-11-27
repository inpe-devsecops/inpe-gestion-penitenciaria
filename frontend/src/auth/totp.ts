// Ayudas de presentación para el segundo factor TOTP (#23). La verificación ocurre solo en el servidor.

// Un código válido tiene exactamente 6 dígitos (lo que generan Google Authenticator, Authy, etc.)
export const esCodigoTotp = (v: string) => /^\d{6}$/.test(v);

// Deja solo dígitos y corta en 6: el usuario puede pegar "123 456" sin error
export const limpiarCodigo = (v: string) => v.replace(/\D/g, '').slice(0, 6);

// La clave en grupos de 4 se copia a mano sin equivocarse ("Ingresar una clave de configuración")
export const agruparClave = (clave: string) => clave.replace(/(.{4})(?=.)/g, '$1 ');
