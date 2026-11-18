# Vitrina

Catálogo de productos y servicios con TanStack Start, TanStack Query, TypeScript, Go, GORM y PostgreSQL. El archivo Vitrina.pen contiene el diseño editable.

## Desarrollo local

Requiere Docker con Compose, Node.js 24, pnpm 11 y la versión de Go declarada en api/go.mod. El importador SQLite requiere un compilador C.

En la raíz, instalá las dependencias una vez:

```sh
pnpm install
```

Con Docker activo, arrancá el proyecto:

```sh
pnpm dev
```

Compose levanta PostgreSQL 17 en 127.0.0.1:55448 y espera a que acepte conexiones. Luego se inicializan las tablas y arranca la API junto a Vite. Ctrl+C detiene ambos procesos. Usá `docker compose stop db` para pausar PostgreSQL. El volumen `postgres_data` conserva los datos entre arranques.

La contraseña predeterminada es para desarrollo local. Podés exportar VITRINA_DB_PASSWORD antes de crear el volumen para elegir otra. Para usar una base externa, configurá DATABASE_URL y ejecutá dev:api y dev:web por separado.

Para importar el catálogo SQLite previo en un volumen vacío, ejecutá `docker compose up -d --wait db` y `sh scripts/dev-api.sh init vitrina.db` antes del primer `pnpm dev`.

La portada es una página de presentación de Vitrina con las tiendas que ya publicaron al menos una ficha. Sus botones llevan a `/registrarse`. Las fotos de la portada están en `web/public/landing`. Con `VITRINA_HOME_SHOP=<enlace>` en el servidor web, abre directamente esa tienda. La tienda de servicios está en /tienda/luna-unas. La API escucha en 127.0.0.1:8080. El servidor de TanStack Start admite VITRINA_API_URL para elegir otra dirección. Cada tienda tiene una agenda, y cada ficha tiene un enlace compartible.

## Registrar una cita

Desde la raíz, con la base Docker activa, el operador puede confirmar una cita indicando la tienda, el servicio, la hora con zona horaria y el nombre del cliente. Elegí una fecha futura:

```sh
sh scripts/dev-api.sh reservar luna-unas manicura-gel '2027-02-18T10:00:00-06:00' 'Cliente de ejemplo'
```

La duración proviene del servicio. Dos servicios de una tienda comparten la misma agenda. La transacción bloquea la fila de la tienda mientras comprueba los cruces y guarda la reserva. Si se configura el número internacional en shops.whatsapp, la ficha también ofrece consultar por WhatsApp.

## Reservas en línea

Cuando el vendedor activa las reservas en línea y define el horario de atención en `/panel`, la ficha de cada servicio visible y disponible muestra un calendario. El cliente elige fecha y hora, deja su nombre y teléfono, y la cita queda agendada al instante.

- Los horarios se ofrecen cada 15 minutos, desde una hora después del momento actual y hasta 60 días adelante. El servicio debe terminar antes del cierre.
- Cada teléfono puede tener hasta dos citas futuras por tienda, y cada tienda acepta hasta 30 reservas en línea por hora.
- Si Resend está configurado, los vendedores de la tienda reciben un correo con los datos de la cita.
- En la agenda del panel, las reservas en línea se marcan como tales y muestran un enlace para escribirle al cliente por WhatsApp.

Las citas que agenda el vendedor desde el panel no están limitadas por el horario de atención.

El comando administrativo requiere acceso al entorno del servidor y a la base de datos.

## Acceso para vendedores

El acceso a `/panel` es por correo. Para habilitar al primer operador y asignar una tienda existente a un vendedor, ejecutá estos comandos desde la raíz con PostgreSQL activo:

```sh
sh scripts/dev-api.sh init
sh scripts/dev-api.sh crear-operador operador@example.com
sh scripts/dev-api.sh asignar-tienda vendedor@example.com luna-unas
```

En `/ingresar`, el vendedor pide un enlace y confirma el acceso al abrirlo. El enlace vence en 15 minutos, se usa una vez y se reemplaza al emitir uno nuevo. Cada correo habilitado puede pedir un enlace por minuto. La sesión vence a los siete días y se revoca al cerrar sesión. Si ya habías creado vendedores en la versión con contraseña, sus correos siguen habilitados y deben volver a ingresar.

### Registro de negocios

En `/registrarse`, cualquier negocio puede abrir su tienda indicando el nombre, el enlace público y su correo. La tienda se crea recién cuando el vendedor abre el enlace que le llega por correo (vence en 15 minutos), y en ese mismo paso entra al panel. Si mientras tanto otra tienda tomó ese enlace, o si el correo ya administra una tienda, solo inicia sesión; un vendedor sin tienda puede crearla desde el panel. Las tiendas aparecen en la portada y en el sitemap cuando tienen al menos una ficha visible.

### Administrar tiendas

- El operador puede crear una tienda en `/panel`, elegir su enlace público `/tienda/<enlace>` y habilitar el correo del vendedor en el mismo paso. El vendedor pide su enlace de acceso en `/ingresar`.
- Los vendedores pueden gestionar las tiendas que tengan asignadas. Pueden editar su perfil público y crear o modificar productos y servicios. La posición ordena las fichas de menor a mayor. Cada opción de una variante puede tener un recargo; la ficha suma los recargos elegidos al precio y el catálogo muestra "Desde". Las fichas ocultas desaparecen tanto del catálogo como de su enlace público. Las fichas marcadas como no disponibles siguen visibles. Una ficha se puede eliminar si nunca tuvo citas; los servicios con citas se ocultan para conservar el historial. Para la foto, el vendedor puede subir un archivo JPG, PNG, WebP o GIF de hasta 5 MB, o indicar una URL HTTPS. Las fotos subidas se guardan en `VITRINA_UPLOAD_DIR` (por defecto `api/uploads`; en producción, el volumen `uploads`).
- La agenda usa la hora de El Salvador. Para agendar una cita, el servicio debe estar visible y disponible. Se pueden reprogramar y cancelar citas futuras. Las citas canceladas quedan en el historial y su horario vuelve a estar disponible.

### Configurar Resend

Verificá el dominio remitente en Resend y mantené desactivado el seguimiento de clics para evitar que reescriba el enlace de acceso. [Configuración de dominios en Resend](https://resend.com/blog/introducing-custom-tracking-domain).

| Variable | Dónde configurarla | Valor |
| --- | --- | --- |
| `RESEND_API_KEY` | API Go | Clave de Resend con permiso de envío. Guardala como secreto del entorno. |
| `RESEND_FROM` | API Go | Remitente de un dominio verificado, como `Vitrina <acceso@vitrina.example>`. |
| `VITRINA_WEB_ORIGIN` | API Go y servidor web | Origen al que apunta el correo, como `https://vitrina.example` o `http://127.0.0.1:5173` en desarrollo local. Abrí la web con ese mismo origen. |

En desarrollo local, copiá `.env.example` como `.env` en la raíz y completá los valores; `pnpm dev` y `scripts/dev-api.sh` lo cargan. En producción van en `deploy/.env`. Para probar sin dominio, dejá `RESEND_API_KEY` vacía con `VITRINA_WEB_ORIGIN` local: la API imprime los correos (enlaces de acceso y avisos de citas) en su consola en lugar de enviarlos.

Reiniciá la API y el servidor web después de configurar las variables. Sin la clave, el catálogo funciona y el formulario informa que el acceso no está disponible. El envío se solicita a Resend en segundo plano y los fallos se registran en la API.

## Despliegue en un VPS

La carpeta `deploy` contiene todo lo necesario para producción en un servidor con Docker y Compose. Caddy obtiene y renueva el certificado HTTPS. PostgreSQL, la API y el servidor web solo son accesibles dentro de la red de Docker.

1. Apuntá un registro DNS `A` (y `AAAA` si tenés IPv6) del dominio a la IP del VPS. Abrí los puertos 80 y 443 en el firewall.
2. Cloná el repositorio en el VPS. Copiá `deploy/.env.example` como `deploy/.env` y completalo. Generá la contraseña de la base con `openssl rand -base64 32`.
3. Levantá el sistema:

   ```sh
   cd deploy
   docker compose --env-file .env up -d --build
   ```

   El servicio `migrate` crea o actualiza las tablas antes de que arranque la API.

4. Habilitá al primer operador:

   ```sh
   docker compose --env-file .env run --rm migrate crear-operador operador@example.com
   ```

Para actualizar, ejecutá `git pull` y repetí el paso 3. Para ver los registros, usá `docker compose --env-file .env logs -f api web`.

La portada, las tiendas con fichas publicadas y sus fichas generan URLs canónicas, vistas previas para compartir y datos estructurados a partir de `VITRINA_WEB_ORIGIN`. Configurá esa variable con el origen público en producción. El sitio publica `/robots.txt`, `/sitemap.xml` y una guía de páginas públicas en `/llms.txt`.

### Respaldos

`deploy/backup.sh` guarda un volcado de PostgreSQL y un archivo con las fotos subidas en `deploy/backups`, y conserva los últimos 14 de cada uno. Programalo con cron, por ejemplo todos los días a las 3:15:

```sh
15 3 * * * /ruta/a/vitrina/deploy/backup.sh >> /var/log/vitrina-backup.log 2>&1
```

Copiá periódicamente esa carpeta fuera del VPS. Para restaurar, ejecutá `deploy/restore.sh backups/<archivo>.dump backups/<fotos>.tar.gz` desde `deploy`. El archivo de fotos es opcional. El script detiene la API y la web mientras restaura.

### Variables de producción

| Variable | Uso |
| --- | --- |
| `VITRINA_DOMAIN` | Dominio público, sin `https://`. |
| `ACME_EMAIL` | Correo para los avisos del certificado HTTPS. |
| `VITRINA_DB_PASSWORD` | Contraseña de PostgreSQL. |
| `VITRINA_HOME_SHOP` | Opcional. Tienda que abre la portada en lugar del directorio. |
| `RESEND_API_KEY`, `RESEND_FROM` | Envío de correos. Ver la sección de Resend. |

La API acepta `VITRINA_API_ADDR` para elegir la dirección de escucha (por defecto `127.0.0.1:8080`) y expone `GET /api/health`. El servidor web de producción (`pnpm --filter vitrina-web start`) usa `HOST` y `PORT`.

## Verificación

En web, ejecutá pnpm build y pnpm check. En api, las pruebas de concurrencia, autenticación y administración usan TEST_DATABASE_URL para conectar con una base PostgreSQL de prueba inicializada mediante el comando init.
