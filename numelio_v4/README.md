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
- `STRIPE_SECRET_KEY`: clave **de pruebas** de Stripe, debe empezar por `sk_test_`.
- `STRIPE_PRICE_ID`: precio recurrente mensual de Numelio Pro creado en modo de pruebas.
- `STRIPE_WEBHOOK_SECRET`: secreto `whsec_...` del endpoint de webhook de pruebas de Stripe.
- `PORT`: Render lo configura normalmente de forma automática.

Los topes preparados para el lanzamiento son compartidos entre todas las funciones de IA: Gratis permite 3 operaciones al mes; Pro permite 30 al mes y un máximo de 3 al día. Crear y corregir un examen cuentan como dos operaciones. La clasificación Pro se lee únicamente de `app_metadata.plan` validado por Supabase. El botón de mejora crea una sesión alojada de Stripe Checkout en modo de pruebas; Pro solo se concede cuando un webhook firmado confirma una suscripción activa y el precio de Numelio Pro.

Para probar pagos, añade en Render las tres variables `STRIPE_*` de arriba con valores **del modo de pruebas**, nunca pegues claves en el código o en el chat. En Stripe, crea un endpoint de webhook de pruebas con URL `https://mi-web-ej4w.onrender.com/api/stripe/webhook` y activa `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` y `invoice.payment_failed`. Guarda su secreto de firma directamente en `STRIPE_WEBHOOK_SECRET` en Render. El servidor rechaza claves `sk_live_` y el producto/precio de prueba no puede cobrar a clientes reales. No publiques la integración hasta revisar y aprobar los cambios y completar la configuración.

Para activar los topes persistentes, ejecuta `supabase/generation_usage.sql` una vez en el SQL Editor de Supabase. En producción, si falta cualquiera de las variables de Supabase necesarias o la función SQL no está disponible, la API rechaza las operaciones de IA con un error 503 en lugar de recurrir a un contador temporal. En desarrollo se puede usar un contador en memoria, que se reinicia al reiniciar el proceso y no sirve como control de producción.

Para mantener previsible el coste inicial, las funciones de IA aceptan texto y PDF con texto seleccionable, pero rechazan imágenes y PDF escaneados. Los adjuntos aceptados siguen sujetos a los límites de tamaño y texto definidos en el servidor.

La clave de Anthropic solo se utiliza en `server.js`. Si alguna clave privada se publicó anteriormente, revócala y genera una nueva.

En Supabase Auth, añade `https://mi-web-ej4w.onrender.com/cuenta.html?reset=1` a las URL de redirección permitidas para que la recuperación de contraseña pueda volver a Numelio.

Cuando se autorice la publicación de esta rama, configura también `/health` como **Health Check Path** del servicio web en Render. Ese endpoint solo comprueba que el proceso responde; no verifica por sí mismo que Supabase o Anthropic estén disponibles.
