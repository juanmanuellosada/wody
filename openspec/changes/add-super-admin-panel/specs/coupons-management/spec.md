## ADDED Requirements

### Requirement: ABM de cupones desde el panel SUPERADMIN

El sistema SHALL exponer en `/admin/coupons` operaciones de listar, crear, editar y eliminar cupones (`Coupon`). Solo usuarios con `role === 'SUPERADMIN'` SHALL poder invocar las server actions que modifican cupones. La eliminación SHALL ser hard-delete (no soft-delete), porque `Coupon` ya tiene el flag `active` para desactivar sin borrar.

#### Scenario: Listado de cupones

- **GIVEN** una sesión SUPERADMIN
- **WHEN** el usuario navega a `/admin/coupons`
- **THEN** el sistema lista todos los cupones existentes con: `slug`, `name`, `rule`, `active`, `expiresAt`, `sortOrder`, contador de redemptions
- **AND** la lista se ordena por `sortOrder` ascendente, luego `createdAt` descendente

#### Scenario: Creación de cupón válido

- **GIVEN** una sesión SUPERADMIN
- **WHEN** el super admin envía el formulario de creación con `slug` único, `name`, `description`, `rule`, `active`, y opcionalmente `instagramHandle`, `instagramUrl`, `websiteUrl`, `expiresAt`, `fixedCode`, `restrictions`, `requiresConsumedSlug`, `hideWhenConsumed`, `sortOrder`, y un logo subido
- **THEN** el sistema sube el logo a Vercel Blob y guarda la URL retornada en `Coupon.logoKey`
- **AND** crea la fila `Coupon` con todos los campos
- **AND** redirige a la lista de cupones

#### Scenario: Slug duplicado al crear

- **GIVEN** una sesión SUPERADMIN y un cupón existente con `slug = "promo-2026"`
- **WHEN** el super admin intenta crear otro cupón con `slug = "promo-2026"`
- **THEN** el sistema rechaza la operación con un error explícito ("slug ya existe")
- **AND** ningún cupón nuevo se crea
- **AND** ningún archivo se sube a Blob (o si ya se subió, se elimina o se ignora)

#### Scenario: Edición preserva campos no enviados

- **GIVEN** un cupón existente
- **WHEN** el super admin edita solo `description` y guarda
- **THEN** el sistema actualiza únicamente `description`
- **AND** preserva todos los demás campos del cupón intactos

#### Scenario: Eliminación de cupón

- **GIVEN** un cupón existente sin redemptions
- **WHEN** el super admin confirma la eliminación
- **THEN** el sistema borra la fila `Coupon` (hard delete)
- **AND** el logo asociado en Vercel Blob SHALL eliminarse

#### Scenario: Eliminación de cupón con redemptions

- **GIVEN** un cupón con al menos una `CouponRedemption` asociada
- **WHEN** el super admin intenta eliminarlo
- **THEN** el sistema rechaza la operación con un error explícito
- **AND** sugiere desactivar (`active = false`) en su lugar

### Requirement: Upload de logo de cupón a Vercel Blob

El sistema SHALL recibir el archivo del logo del cupón en una server action que valide tipo MIME (PNG, JPEG, WebP, SVG) y tamaño máximo (2 MB), lo suba a Vercel Blob con `access: 'public'` y `addRandomSuffix: true`, y retorne la URL pública.

#### Scenario: Upload exitoso

- **GIVEN** una sesión SUPERADMIN y un archivo válido (PNG, 500 KB)
- **WHEN** la server action de upload se invoca con ese archivo
- **THEN** el sistema sube el archivo a Vercel Blob
- **AND** retorna la URL pública

#### Scenario: Archivo inválido

- **GIVEN** una sesión SUPERADMIN y un archivo PDF
- **WHEN** la server action se invoca
- **THEN** el sistema rechaza el upload con error explícito
- **AND** no toca Vercel Blob

#### Scenario: Token de Blob ausente

- **GIVEN** un entorno sin `BLOB_READ_WRITE_TOKEN` configurado
- **WHEN** la server action de upload se invoca
- **THEN** el sistema rechaza con error explícito ("Vercel Blob no configurado")
- **AND** no intenta el upload
