-- Production bootstrap reference data for the Rawson pilot.
--
-- Scope is intentionally limited to shared reference data only:
-- provinces, cities, zones and marketplace_categories.
--
-- It MUST NOT seed merchants, users, memberships, products, orders, Auth users
-- or Storage objects.
--
-- Safe to rerun when the same canonical UUIDs already exist. Natural-key
-- conflicts with different UUIDs fail instead of silently remapping relations.

BEGIN;

INSERT INTO public.provinces (id, name, code)
VALUES (
  '5a040035-4eca-4e4d-8516-d372bd66f627'::uuid,
  'Chubut',
  'AR-U'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  updated_at = now();

INSERT INTO public.cities (id, province_id, name, slug, timezone)
VALUES (
  'ac8e7f28-51e9-498e-8e5b-9a303c090d7b'::uuid,
  '5a040035-4eca-4e4d-8516-d372bd66f627'::uuid,
  'Rawson',
  'rawson',
  'America/Argentina/Catamarca'
)
ON CONFLICT (id) DO UPDATE SET
  province_id = EXCLUDED.province_id,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  timezone = EXCLUDED.timezone,
  updated_at = now();

INSERT INTO public.zones (id, city_id, name, slug)
VALUES
  (
    'd4acca83-c9a2-46a3-96dd-96de59b37baf'::uuid,
    'ac8e7f28-51e9-498e-8e5b-9a303c090d7b'::uuid,
    'Playa Unión',
    'playa-union'
  ),
  (
    'e2e00969-a5ac-45e3-ab38-a9262acb486b'::uuid,
    'ac8e7f28-51e9-498e-8e5b-9a303c090d7b'::uuid,
    'Rawson',
    'rawson'
  )
ON CONFLICT (id) DO UPDATE SET
  city_id = EXCLUDED.city_id,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  updated_at = now();

INSERT INTO public.marketplace_categories (id, name, slug, sort_order, active)
VALUES
  (
    'cdfbf3a0-a21f-4a5c-b664-6e34a8af3f71'::uuid,
    'Comida',
    'comida',
    10,
    true
  ),
  (
    '26d98333-e241-44e9-acd9-00a2d2270f97'::uuid,
    'Empanadas',
    'empanadas',
    20,
    true
  ),
  (
    'b8c83a72-0ffe-4be6-b93a-49f2f78d977c'::uuid,
    'Bebidas',
    'bebidas',
    30,
    true
  ),
  (
    '8c491bd4-20b0-4c2e-b333-e18821b78f07'::uuid,
    'Cafetería',
    'cafeteria',
    40,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active,
  updated_at = now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.cities c
    WHERE c.id = 'ac8e7f28-51e9-498e-8e5b-9a303c090d7b'::uuid
      AND c.province_id = '5a040035-4eca-4e4d-8516-d372bd66f627'::uuid
  ) THEN
    RAISE EXCEPTION 'Production reference seed verification failed: Rawson city relation';
  END IF;

  IF (
    SELECT count(*)
    FROM public.zones
    WHERE id IN (
      'd4acca83-c9a2-46a3-96dd-96de59b37baf'::uuid,
      'e2e00969-a5ac-45e3-ab38-a9262acb486b'::uuid
    )
  ) <> 2 THEN
    RAISE EXCEPTION 'Production reference seed verification failed: zones';
  END IF;

  IF (
    SELECT count(*)
    FROM public.marketplace_categories
    WHERE id IN (
      'cdfbf3a0-a21f-4a5c-b664-6e34a8af3f71'::uuid,
      '26d98333-e241-44e9-acd9-00a2d2270f97'::uuid,
      'b8c83a72-0ffe-4be6-b93a-49f2f78d977c'::uuid,
      '8c491bd4-20b0-4c2e-b333-e18821b78f07'::uuid
    )
  ) <> 4 THEN
    RAISE EXCEPTION 'Production reference seed verification failed: marketplace categories';
  END IF;
END;
$$;

COMMIT;
