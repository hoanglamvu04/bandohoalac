import { pool } from '../database/pool.js';

export async function listCategories() {
  const { rows } = await pool.query(
    'SELECT id, name, slug, icon FROM categories ORDER BY name ASC'
  );
  return rows;
}

export async function findCategoryBySlug(slug, client = pool) {
  const { rows } = await client.query(
    'SELECT id, name, slug, icon FROM categories WHERE slug = $1',
    [slug]
  );
  return rows[0] || null;
}

export async function findCategoryById(id, client = pool) {
  const { rows } = await client.query(
    'SELECT id, name, slug, icon FROM categories WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}
