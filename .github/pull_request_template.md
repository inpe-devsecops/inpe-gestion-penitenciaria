## ¿Qué cambia?

<!-- Requerimiento o issue relacionado: RF-.. / RNF-.. / #.. -->

## Lista de verificación de seguridad

- [ ] No incluye secretos, claves ni archivos `.env`
- [ ] Toda entrada nueva se valida en el servidor (Zod) y no acepta operadores `$`
- [ ] Los endpoints nuevos verifican rol **y** ámbito (oficina o establecimiento) del usuario, denegado por defecto
- [ ] No se agregan datos personales a la ficha (RNF-08) ni se registran en logs; el texto libre sensible se guarda cifrado
- [ ] Tiene pruebas, incluidas las de los requisitos de seguridad afectados
- [ ] El pipeline (pruebas, Semgrep, Gitleaks, npm audit) está en verde

## Evidencia

<!-- Capturas o salida de pruebas -->
