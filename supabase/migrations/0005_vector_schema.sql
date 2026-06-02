-- Fase 3 · mover la extensión pgvector al schema `extensions` (recomendación
-- de Supabase: no instalar extensiones en `public`). Atómico: Postgres mueve
-- el tipo `vector`, operadores y clases de operador juntos; las columnas y el
-- índice ivfflat existentes mantienen la referencia por OID.
alter extension vector set schema extensions;
