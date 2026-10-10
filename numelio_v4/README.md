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
