# Numelio v4

Versión integrada: mantiene la web de Numelio v2 (inicio, calculadoras, diseño, modo oscuro y zona de estudio) y añade un backend real con Claude para generar y corregir exámenes.

## Arrancar
1. Instala Node.js.
2. Abre una terminal en esta carpeta.
3. `npm install`
4. Copia `.env.example` como `.env`.
5. Pon tu clave en `ANTHROPIC_API_KEY`.
6. `npm start`
7. Abre `http://localhost:3000`

La API key debe quedarse en el servidor, nunca en el HTML/JavaScript del navegador.


## Variables de entorno para producción

Configura estas variables en el panel de Render (Environment), nunca en archivos versionados:

- `ANTHROPIC_API_KEY`: clave privada de Anthropic.
- `SUPABASE_URL`: URL del proyecto Supabase.
- `SUPABASE_PUBLISHABLE_KEY`: clave pública de Supabase para validar sesiones.
- `SUPABASE_SERVICE_ROLE_KEY`: clave privada de servidor; no debe enviarse al navegador ni publicarse en GitHub.
- `PORT`: Render lo configura normalmente de forma automática.

Para activar el límite diario persistente de 10 operaciones de IA, ejecuta una vez `supabase/generation_usage.sql` en el SQL Editor de Supabase. En producción, si falta cualquiera de las variables de Supabase necesarias o la función SQL no está disponible, la API rechaza las operaciones de IA con un error 503 en lugar de recurrir a un contador temporal. En desarrollo se puede usar un contador en memoria, que se reinicia al reiniciar el proceso y no sirve como control de producción.

La clave de Anthropic solo se utiliza en `server.js`. Si alguna clave privada se publicó anteriormente, revócala y genera una nueva.

En Supabase Auth, añade `https://mi-web-ej4w.onrender.com/cuenta.html?reset=1` a las URL de redirección permitidas para que la recuperación de contraseña pueda volver a Numelio.

Cuando se autorice la publicación de esta rama, configura también `/health` como **Health Check Path** del servicio web en Render. Ese endpoint solo comprueba que el proceso responde; no verifica por sí mismo que Supabase o Anthropic estén disponibles.
