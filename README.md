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

El comando administrativo requiere acceso al entorno del servidor y a la base de datos. El panel web para vendedores y la autenticación por correo siguen pendientes.

## Verificación

En web, ejecutá pnpm build y pnpm check. En api, la prueba de concurrencia usa TEST_DATABASE_URL para conectar con una base PostgreSQL de prueba inicializada mediante el comando init.
