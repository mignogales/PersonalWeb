# Chat experimental

Ruta: `/apps/chat-lab/`. No está enlazada desde la portada; incluye noindex.
La página es pública, pero `/api/chat` requiere una contraseña de prueba.

## Configuración

En Cloudflare → Workers & Pages → mainpersonalweb → Settings → Variables and Secrets, añadir como **Secret**:

- `GEMINI_API_KEY`: clave creada en Google AI Studio.
- `CHAT_TEST_PASSWORD`: contraseña aleatoria larga para esta prueba (distinta de la API key).

Variable opcional: `GEMINI_MODEL`, predeterminado `gemini-2.5-flash`.
Gemini 2.0 Flash fue retirado el 1 de junio de 2026 según Google.
No hay cambio automático de modelo ni activación de facturación.
Usar un proyecto de AI Studio sin facturación para mantener la prueba en el nivel gratuito; comprobar sus cuotas en AI Studio.

Para probar localmente, copiar `.dev.vars.example` a `.dev.vars`, rellenarlo y ejecutar `npx wrangler dev`. Abrir la ruta de prueba en la URL local de Wrangler (un servidor estático no ejecuta la API).
Para publicar el código, utilizar el flujo habitual del Worker o `npx wrangler deploy` desde la raíz. La implementación no se ha desplegado automáticamente.

## Clave y límites

El navegador llama al Worker, que llama a Google con el secreto en una cabecera. La API key nunca se envía al navegador. No incluirla en HTML, JS, URLs, Git o variables públicas. `.assetsignore` excluye secretos y código de servidor de los archivos públicos.
La contraseña solo se mantiene en el campo de esta pestaña; se transmite mediante HTTPS al Worker. No es un sistema de cuentas: cualquier persona con ella puede usar el endpoint. El enlace oculto y noindex no son control de acceso.
Las solicitudes se limitan a 24 KB, 15 mensajes y 2000 caracteres por mensaje; la respuesta a 512 tokens. Las cuotas de Google son el límite de frecuencia: no hay un contador distribuido propio. Para una apertura pública, añadir Cloudflare Access o rate limiting persistente.
No se guardan conversaciones en el backend ni se registran claves o mensajes en el código. Google recibe el historial enviado; consultar sus condiciones del nivel gratuito.

Verificación local: `node --test tests/chat.test.mjs`. Las pruebas usan Gemini simulado; hace falta configurar la clave para verificar una respuesta real.
