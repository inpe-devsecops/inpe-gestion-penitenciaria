## ¿Qué cambia?

<!-- Historia de usuario o issue relacionado: HU.. / #.. -->

## Lista de verificación de seguridad

- [ ] No incluye secretos, claves ni archivos `.env`
- [ ] Toda entrada nueva se valida en el servidor (Zod) y no acepta operadores `$`
- [ ] Los endpoints nuevos verifican rol **y** penal del usuario (denegado por defecto)
- [ ] No se registran datos personales en logs; los campos sensibles se guardan cifrados
- [ ] Tiene pruebas, incluidas las de los requisitos de seguridad afectados
- [ ] El pipeline (pruebas, Semgrep, Gitleaks, npm audit) está en verde

## Evidencia

<!-- Capturas o salida de pruebas -->
