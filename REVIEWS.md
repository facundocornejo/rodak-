# Reseñas — alta y aprobación manual

**Fecha:** 2026-07-25 · **Alcance:** Fase 2 (diseño D9/D10, `sdd/fase-2-pdp/design`). Este documento es el ÚNICO camino para cargar y aprobar reseñas en esta fase: no existe endpoint público de alta ni panel de moderación. El storefront solo renderiza filas con `status='APPROVED'`; `PENDING`/`REJECTED` nunca aparecen en la web pública.

## Por qué es manual

La reseña se pide/recibe fuera del sitio (mail, WhatsApp, lo que use Facu con el cliente) y se carga a mano en la base con `psql`, dentro del contenedor de Postgres administrado por Coolify. No hay formulario de alta ni moderación en Fase 2 — construir eso es trabajo de una fase futura (ver spec `product-reviews`, capability read-only).

## Cómo conectarse

Desde el servidor (o vía el panel de Coolify → recurso de la base → "Terminal"), abrir una sesión `psql` dentro del contenedor de la base de datos de producción. No hace falta credencial embebida acá: usar el mismo mecanismo con el que ya se opera la base (variable de entorno del contenedor, o el shell que expone Coolify). Ejemplo genérico, sin contraseña a la vista:

```bash
docker exec -it <contenedor-postgres> psql -U <usuario> -d <base>
```

(`<contenedor-postgres>`, `<usuario>` y `<base>` son los que ya usa el proyecto en Coolify — no se repiten acá para no tener un valor de conexión copiado en el repo.)

## 1. Insertar una reseña (siempre queda en PENDING)

**Plantilla parametrizada.** `status` NUNCA se pasa como parámetro — está fijo en `'PENDING'` en el propio SQL, así una reseña recién cargada jamás aparece en el sitio hasta que se apruebe a mano en el paso 2.

```sql
INSERT INTO "Review" (id, "productId", rating, title, body, "authorName", "authorEmail", "updatedAt")
VALUES (
  gen_random_uuid()::text,  -- o cualquier string único; el DAL no depende del formato del id
  $1,                        -- productId: el id (cuid) del producto, NO el slug
  $2,                        -- rating: entero 1 a 5 (constraint "Review_rating_range" rechaza el resto)
  $3,                        -- title: texto corto o NULL
  $4,                        -- body: el cuerpo de la reseña
  $5,                        -- authorName: nombre a mostrar públicamente
  $6,                        -- authorEmail: OPCIONAL, uso interno — nunca se expone en el sitio [INV-3]
  now()
);
```

En `psql` interactivo (sin driver que resuelva `$1..$6`), reemplazar cada parámetro a mano antes de ejecutar, por ejemplo:

```sql
INSERT INTO "Review" (id, "productId", rating, title, body, "authorName", "authorEmail", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'cmrw9vx5w002p3s41pre8zh64',
  5,
  'Excelente mesa',
  'Llegó perfecta, muy buena terminación.',
  'María G.',
  NULL,
  now()
);
```

> **Comillas simples en el texto.** Si el nombre o el cuerpo traen un apóstrofo
> (`D'Angelo`, `l'atelier`), pegarlo tal cual **rompe el SQL** con un error de
> sintaxis. Se escapa duplicando la comilla: `'D''Angelo'`. Alternativa más
> segura para textos largos: usar dollar-quoting, que no necesita escapar nada:
>
> ```sql
> $texto$Llegó perfecta, ni un detalle. Es la mesa d'entrada.$texto$
> ```

Para encontrar el `productId` de un producto por su slug:

```sql
SELECT id, slug, name FROM "Product" WHERE slug = 'mesa-kendall';
```

## 2. Aprobar una reseña (la hace visible)

Recién en este paso la reseña puede aparecer en el sitio — el DAL (`src/lib/data/reviews.ts`) solo lee `status='APPROVED'`.

```sql
UPDATE "Review" SET status='APPROVED', "updatedAt"=now() WHERE id=$1;
```

Reemplazando `$1` por el `id` real:

```sql
UPDATE "Review" SET status='APPROVED', "updatedAt"=now() WHERE id='<id-de-la-reseña>';
```

## 3. Rechazar una reseña (opcional)

Mismo patrón, con `REJECTED` en vez de `APPROVED`. Una reseña `REJECTED` nunca se borra por defecto — queda en la base para trazabilidad, simplemente no se renderiza nunca.

```sql
UPDATE "Review" SET status='REJECTED', "updatedAt"=now() WHERE id='<id-de-la-reseña>';
```

## 4. Corregir o dar marcha atrás

Nada de esto es irreversible mientras la fila exista: `status` es un campo más y
se puede volver a mover.

Sacar del sitio una reseña que se aprobó por error (vuelve a ser invisible):

```sql
UPDATE "Review" SET status='PENDING', "updatedAt"=now() WHERE id='<id-de-la-reseña>';
```

Corregir el texto o el puntaje de una reseña ya cargada:

```sql
UPDATE "Review"
SET title=$1, body=$2, rating=$3, "updatedAt"=now()
WHERE id='<id-de-la-reseña>';
```

Antes de tocar nada, ver qué hay:

```sql
SELECT id, rating, title, "authorName", status, "createdAt"
FROM "Review" WHERE "productId" = '<id-del-producto>' ORDER BY "createdAt" DESC;
```

## Recordatorios

- `authorEmail` es opcional y **nunca** debe usarse para nada público — es solo para que Facu pueda responder por fuera del sitio si hace falta.
- `rating` fuera de 1-5 es rechazado por la base (constraint `Review_rating_range`), no por la aplicación.
- Una reseña sin aprobar (`PENDING`) o rechazada (`REJECTED`) es indistinguible de "no existe" para cualquier visitante del sitio.
