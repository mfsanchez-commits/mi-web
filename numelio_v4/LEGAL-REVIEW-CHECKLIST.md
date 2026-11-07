# Preparación de documentación legal — Numelio

Estado: borrador interno de trabajo. No es asesoramiento jurídico ni una declaración de cumplimiento. No publicar como documento legal para usuarios.

## 1. Datos que debe confirmar el titular

- [ ] Titular real del servicio: nombre y apellidos de la persona física, o denominación social completa de la empresa.
- [ ] Forma de actividad y situación censal/fiscal aplicable (persona física/ autónomo/sociedad). Confirmar con asesoría; no inferirlo.
- [ ] NIF/NIE/CIF que corresponda.
- [ ] Domicilio legal o profesional que deba publicarse.
- [ ] Correo de contacto operativo para consultas legales y ejercicio de derechos.
- [ ] Teléfono u otro medio directo de contacto, si corresponde.
- [ ] Datos de registro público/mercantil, únicamente si procede.
- [ ] Fecha de inicio del servicio y fecha efectiva de publicación de cada política.

## 2. Datos comerciales que deben coincidir con el checkout

- [ ] Precio final de Numelio Pro, indicando moneda e impuestos aplicables.
- [ ] Periodicidad exacta (mensual/anual) y momento del primer cobro.
- [ ] Renovación automática, aviso de renovación si procede y forma de cancelar.
- [ ] Qué funciones y límites incluye cada plan.
- [ ] Procedimiento de baja y efecto sobre el acceso a Pro. Verificación técnica del 26-10-2026: existe `POST /api/billing/portal` y el botón «Gestionar suscripción» en `mi-espacio.html`; el portal test está activo. Se creó en Stripe live la configuración `bpc_1UUuO92VmxR7JG4YcV6hCrak`, marcada como predeterminada, con consulta de facturas, actualización de nombre/correo/método de pago y cancelación al final del periodo (`subscription_cancel.enabled=true`, `mode=at_period_end`). Precio live comprobado: 9,99 EUR/mes, activo. Webhook live habilitado en `https://mi-web-ej4w.onrender.com/api/stripe/webhook` para checkout, suscripciones e invoices. Pendiente prueba end-to-end en test de suscripción, cancelación y sincronización del plan mediante webhook; confirmar que el endpoint desplegado usa la configuración/clave live solo cuando se autorice el lanzamiento.
- [ ] Política de reembolso y tratamiento del derecho de desistimiento para contenido/servicios digitales, con el flujo de consentimiento expreso que corresponda.
- [ ] Identidad del comerciante que aparece en Stripe, descriptor del extracto y recibos/facturas. Revisión de cuenta live el 26-10-2026: Stripe indica que la verificación de identidad del representante no está completada correctamente aunque `charges_enabled` y `payouts_enabled` aparecen habilitados. El titular debe resolver la verificación directamente en Stripe Dashboard antes de aceptar pagos reales; no compartir ni incluir documentos de identidad en el repositorio.
- [ ] Procedimiento de atención de reclamaciones.
- [ ] Confirmar si se venderá exclusivamente a consumidores en España o también a otros países.

## 3. Tratamiento de datos observado en el código revisado

- Cuenta y autenticación: Supabase Auth; se utiliza correo electrónico e identificador de cuenta. La autenticación y gestión de contraseñas la realiza Supabase.
- Materiales de estudio: el usuario puede aportar texto, PDF, TXT e imágenes JPG/JPEG/PNG/WEBP (hasta 10 MB por archivo) para funciones de estudio con IA.
- Proveedor de IA: Anthropic. El contenido enviado a las funciones de IA se transmite para procesar la solicitud.
- Pagos/suscripciones: Stripe; el portal live y el precio live están configurados, pero no deben habilitarse cobros reales hasta cerrar revisión.
- Historial de exámenes: se guarda un resumen del resultado asociado a la cuenta (por ejemplo, asignatura, título, nota/aciertos y fecha); verificar contra el esquema y la versión desplegada antes de publicar.
- Límites de uso: la tabla `generation_usage` registra identificador de usuario si lo hay, hash de IP, función y fecha/hora. El hash de IP sigue pudiendo ser dato personal si permite singularizar a una persona; describirlo como dato seudonimizado, no anónimo.
- Archivos temporales de subida: revisión estática de `server.js` confirma borrado en bloques `finally` para las rutas de generación de examen, flashcards, examen oral y tutoría, incluso cuando la función termina por error después de entrar en la ruta. Pendiente: probar en el servicio desplegado las subidas rechazadas/límites de tamaño y comprobar qué ocurre ante un cierre abrupto del proceso; el bloque `finally` no garantiza limpieza si el proceso se interrumpe de golpe.
- Preferencias: localStorage guarda el tema visual. Supabase Auth puede guardar información de sesión en el almacenamiento del navegador.
- Bibliotecas: se carga el cliente de Supabase desde jsDelivr CDN. Revisar además las demás páginas y las solicitudes de red reales en producción.
- No afirmar que no hay cookies/analítica de terceros hasta realizar una inspección del sitio desplegado y sus respuestas de red.
- Copias de seguridad, plazos de borrado, región y condiciones contractuales de proveedores: confirmar en paneles/contratos antes de fijar los textos definitivos.

## 4. Decisiones de privacidad y seguridad pendientes

- [ ] Determinar la base jurídica de cada finalidad y documentarla; no usar un consentimiento genérico para todo.
- [ ] Confirmar si se almacenan apuntes/archivos permanentemente en Supabase y qué tablas/objetos concretos contienen esos materiales.
- [ ] Definir plazos reales de conservación y borrado para cuenta, apuntes, historial, límites de uso, registros y copias de seguridad. La tabla `generation_usage` no declara FK a `auth.users`, por lo que borrar la cuenta no elimina automáticamente esos registros.
- [ ] Revisar contratos de encargado del tratamiento, subencargados y transferencias internacionales de Supabase, Anthropic, Stripe, Render y CDN.
- [ ] Revisar configuración de RLS, almacenamiento, claves, registros y recuperación de cuenta. En `server.js` y `cuenta.html` no se ha localizado un flujo para eliminar la cuenta completa. Diseñarlo y probarlo con borrado de Auth, apuntes, archivos del bucket `archivos-apuntes`, flashcards, historial de estudio/exámenes y registros de uso asociados; tratar por separado los datos que deban conservarse legalmente. Si existe suscripción activa, exigir cancelación o resolverla antes de eliminar la cuenta.
- [ ] Definir procedimiento de solicitudes de derechos RGPD y contacto para reclamaciones.
- [ ] Definir la política de edad y contratación: distinguir consentimiento de datos personales, capacidad para contratar y reglas aplicables a menores.
- [ ] Revisar si se necesita evaluación de impacto u otras medidas según los datos y riesgos reales.
- [ ] Verificar cookies, localStorage, tecnologías similares y necesidad de un gestor de consentimiento; aceptar y rechazar cookies no necesarias deben ofrecerse de forma equivalente cuando sea exigible.
- [ ] Confirmar el versionado de las condiciones: el checkout guarda fecha y versión en metadata de Stripe; conservar una copia inmutable de cada versión aceptada y vincularla al evento de aceptación. Stripe test tiene un webhook activo en `https://mi-web-ej4w.onrender.com/api/stripe/webhook` para checkout, suscripciones e invoices; queda probar la entrega real y el resultado en Supabase. Stripe live también tiene un webhook activo y se ha creado una configuración live del Customer Portal, pero no se han activado cobros; mantener `STRIPE_MODE=test` hasta cerrar la revisión.
- [ ] Revisar que la casilla de aceptación no esté premarcada y que los enlaces abran las versiones exactas aplicables antes de pagar.
- [ ] Revisar la información de privacidad en formularios de cuenta y subida de archivos, no solo en el pie de página.

## 5. Estado de publicación

Bloqueo de pagos live detectado el 26-10-2026: la cuenta Stripe live muestra un estado de verificación de identidad no resuelto. No activar `STRIPE_MODE=live` ni anunciar la venta hasta que el titular complete la verificación desde el Dashboard, se revise la situación legal/fiscal y se realice una prueba integral en modo test. Los indicadores técnicos de capacidad de cobro no sustituyen la verificación de identidad ni una revisión legal.


Los cuatro documentos públicos actuales contienen avisos de provisionalidad y campos pendientes. No eliminar esos avisos ni habilitar pagos reales hasta completar los datos y revisar los textos. Mantener Stripe en modo de pruebas.

## 6. Fuentes oficiales para la revisión

- LSSI (Ley 34/2002), especialmente información general del prestador: https://www.boe.es/eli/es/l/2002/07/11/34/con
- LOPDGDD (Ley Orgánica 3/2018), incluido el artículo 7 sobre consentimiento de menores: https://www.boe.es/eli/es/lo/2018/12/05/3
- Guía de cookies de la AEPD: https://www.aepd.es/guias/guia-cookies.pdf
- Preguntas frecuentes de la AEPD sobre cookies: https://www.aepd.es/preguntas-frecuentes/17-internet-y-redes-sociales/FAQ-1707-importancia-de-las-cookies-en-la-proteccion-de-datos

Última revisión técnica inicial: 26 de octubre de 2026.
