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

La portada abre Marea Estudio. La tienda de servicios está en /tienda/luna-unas. La API escucha en 127.0.0.1:8080. El servidor de TanStack Start admite VITRINA_API_URL para elegir otra dirección. Cada tienda tiene una agenda, y cada ficha tiene un enlace compartible.

## Registrar una cita

Desde la raíz, con la base Docker activa, el operador puede confirmar una cita indicando la tienda, el servicio, la hora con zona horaria y el nombre del cliente. Elegí una fecha futura:

```sh
sh scripts/dev-api.sh reservar luna-unas manicura-gel '2027-02-18T10:00:00-06:00' 'Cliente de ejemplo'
```

La duración proviene del servicio. Dos servicios de una tienda comparten la misma agenda. La transacción bloquea la fila de la tienda mientras comprueba los cruces y guarda la reserva. En la ficha pública solo se consulta el horario al negocio. Si se configura el número internacional en shops.whatsapp, la consulta abre WhatsApp.

El comando administrativo requiere acceso al entorno del servidor y a la base de datos.

## Acceso para vendedores

El acceso a `/panel` es por correo. Para habilitar al primer operador y asignar una tienda existente a un vendedor, ejecutá estos comandos desde la raíz con PostgreSQL activo:

```sh
sh scripts/dev-api.sh init
sh scripts/dev-api.sh crear-operador operador@example.com
sh scripts/dev-api.sh asignar-tienda vendedor@example.com luna-unas
```

En `/ingresar`, el vendedor pide un enlace y confirma el acceso al abrirlo. El enlace vence en 15 minutos, se usa una vez y se reemplaza al emitir uno nuevo. Cada correo habilitado puede pedir un enlace por minuto. La sesión vence a los siete días y se revoca al cerrar sesión. Si ya habías creado vendedores en la versión con contraseña, sus correos siguen habilitados y deben volver a ingresar.

### Administrar tiendas

- El operador puede crear una tienda en `/panel`, elegir su enlace público `/tienda/<enlace>` y habilitar el correo del vendedor en el mismo paso. El vendedor pide su enlace de acceso en `/ingresar`.
- Los vendedores pueden gestionar las tiendas que tengan asignadas. Pueden editar su perfil público y crear o modificar productos y servicios. La posición ordena las fichas de menor a mayor. Las fichas ocultas desaparecen tanto del catálogo como de su enlace público. Las fichas marcadas como no disponibles siguen visibles. Para una foto personalizada, usá una URL HTTPS de la imagen.
- La agenda usa la hora de El Salvador. Para agendar una cita, el servicio debe estar visible y disponible. Se pueden reprogramar y cancelar citas futuras. Las citas canceladas quedan en el historial y su horario vuelve a estar disponible.

### Configurar Resend

Verificá el dominio remitente en Resend y mantené desactivado el seguimiento de clics para evitar que reescriba el enlace de acceso. [Configuración de dominios en Resend](https://resend.com/blog/introducing-custom-tracking-domain).

| Variable | Dónde configurarla | Valor |
| --- | --- | --- |
| `RESEND_API_KEY` | API Go | Clave de Resend con permiso de envío. Guardala como secreto del entorno. |
| `RESEND_FROM` | API Go | Remitente de un dominio verificado, como `Vitrina <acceso@vitrina.example>`. |
| `VITRINA_WEB_ORIGIN` | API Go y servidor web | Origen al que apunta el correo, como `https://vitrina.example` o `http://127.0.0.1:5173` en desarrollo local. Abrí la web con ese mismo origen. |

Reiniciá la API y el servidor web después de configurar las variables. Sin la clave, el catálogo funciona y el formulario informa que el acceso no está disponible. El envío se solicita a Resend en segundo plano y los fallos se registran en la API.

## Verificación

En web, ejecutá pnpm build y pnpm check. En api, las pruebas de concurrencia, autenticación y administración usan TEST_DATABASE_URL para conectar con una base PostgreSQL de prueba inicializada mediante el comando init.
