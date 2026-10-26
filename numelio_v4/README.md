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
- `STRIPE_MODE`: `test` (predeterminado si se omite) o `live`. El servidor solo acepta claves del modo seleccionado.
- `STRIPE_SECRET_KEY`: clave privada de Stripe del modo elegido (`sk_test_`/`rk_test_` en pruebas o `sk_live_`/`rk_live_` en activo). Una clave restringida con permisos mínimos es preferible; nunca la guardes en Git ni la compartas.
- `STRIPE_PRICE_ID`: precio recurrente mensual de Numelio Pro creado en el mismo modo que `STRIPE_MODE`.
- `STRIPE_WEBHOOK_SECRET`: secreto `whsec_...` del endpoint de webhook creado en el mismo modo.
- `PORT`: Render lo configura normalmente de forma automática.

Los topes preparados para el lanzamiento son compartidos entre todas las funciones de IA: Gratis permite 3 operaciones al mes; Pro permite 30 al mes y un máximo de 3 al día. Crear y corregir un examen cuentan como dos operaciones. La clasificación Pro se lee de metadatos de servidor en Supabase y se mantiene separada por entorno (`stripe_test_plan` y `stripe_live_plan`), para que una suscripción de pruebas no dé acceso Pro en modo activo. La web consulta `/api/billing/status` para mostrar el entorno que usa el servidor.

Para pruebas, configura `STRIPE_MODE=test` y usa la clave, el precio y el secreto del webhook del modo de pruebas. En Stripe, crea un endpoint de webhook de pruebas con URL `https://numelio.es/api/stripe/webhook` y activa `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` y `invoice.payment_failed`.

Para producción, crea en el modo activo un producto/precio recurrente de Numelio Pro y un endpoint live en la misma URL con esos eventos. Luego configura en Render `STRIPE_MODE=live`, una clave live, el ID del precio live y el secreto de firma de ese endpoint live. El servidor rechaza claves cuyo prefijo no corresponda al modo seleccionado y webhooks de otro modo. Cambiar a live habilita pagos reales; revisa el importe y la configuración antes de guardar o desplegar. Mantén cada secreto solo en las variables protegidas de Render; no lo pegues en el código ni en el chat. Los productos, precios y clientes de prueba no se convierten automáticamente en objetos live.

Para activar los topes persistentes, ejecuta `supabase/generation_usage.sql` una vez en el SQL Editor de Supabase. En producción, si falta cualquiera de las variables de Supabase necesarias o la función SQL no está disponible, la API rechaza las operaciones de IA con un error 503 en lugar de recurrir a un contador temporal. En desarrollo se puede usar un contador en memoria, que se reinicia al reiniciar el proceso y no sirve como control de producción.

Las funciones de IA aceptan texto, PDF con texto seleccionable o escaneado, y fotos JPG, PNG o WEBP de hasta 10 MB. Las imágenes y los PDF escaneados se envían al modelo para lectura visual; revisa siempre los resultados, porque la IA puede interpretar mal partes poco legibles. Los límites de uso de IA siguen aplicándose para controlar el consumo.

La clave de Anthropic solo se utiliza en `server.js`. Si alguna clave privada se publicó anteriormente, revócala y genera una nueva.

En Supabase Auth, añade `https://numelio.es/cuenta.html?reset=1` a las URL de redirección permitidas para que la recuperación de contraseña pueda volver a Numelio.

Cuando se autorice la publicación de esta rama, configura también `/health` como **Health Check Path** del servicio web en Render. Ese endpoint solo comprueba que el proceso responde; no verifica por sí mismo que Supabase o Anthropic estén disponibles.
