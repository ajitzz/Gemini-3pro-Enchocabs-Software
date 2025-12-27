const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { parseLeadFile, stripPhone } = require('./utils/leadImport');

const upload = multer();

const canAccess = (req) => {
  const role = (req.headers['x-user-role'] || '').toString();
  return ['super_admin', 'admin', 'manager'].includes(role);
};

const leadRoutes = (db) => {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!canAccess(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  });

  // Lead lists
  router.get('/lead-lists', async (_req, res) => {
    const result = await db.query('SELECT id, name, archived, created_at, updated_at FROM lead_lists WHERE archived = false ORDER BY created_at DESC');
    res.json(result.rows);
  });

  router.post('/lead-lists', async (req, res) => {
    const { name } = req.body;
    const id = uuidv4();
    const result = await db.query('INSERT INTO lead_lists (id, name) VALUES ($1, $2) RETURNING *', [id, name]);
    res.json(result.rows[0]);
  });

  router.patch('/lead-lists/:id', async (req, res) => {
    const { name, archived } = req.body;
    const result = await db.query('UPDATE lead_lists SET name = COALESCE($2, name), archived = COALESCE($3, archived), updated_at = NOW() WHERE id = $1 RETURNING *', [req.params.id, name, archived]);
    res.json(result.rows[0]);
  });

  router.post('/lead-lists/:id/leads', async (req, res) => {
    const {
      name,
      platform,
      source,
      phone,
      city,
      status_id,
      follow_up_at,
      assigned_to,
      notes,
      custom_fields,
      lead_capture_at,
    } = req.body || {};

    if (!name || !platform) return res.status(400).json({ error: 'Name and platform are required' });
    const phone_normalized = stripPhone(phone);
    if (!phone_normalized) return res.status(400).json({ error: 'Phone is required' });

    const id = uuidv4();
    const statusQuery = await db.query('SELECT id FROM lead_statuses WHERE list_id = $1 ORDER BY sort_order LIMIT 1', [req.params.id]);
    const statusId = status_id || (statusQuery.rows[0] ? statusQuery.rows[0].id : null);

    const insert = await db.query(
      'INSERT INTO leads (id, list_id, lead_capture_at, name, platform, source, phone, phone_normalized, city, status_id, follow_up_at, assigned_to, notes, custom_fields) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',
      [
        id,
        req.params.id,
        lead_capture_at || new Date().toISOString(),
        name,
        platform,
        source || platform,
        phone,
        phone_normalized,
        city,
        statusId,
        follow_up_at || null,
        assigned_to || null,
        notes || null,
        custom_fields || {},
      ],
    );

    await db.query('INSERT INTO lead_events (id, lead_id, actor_email, event_type, before, after) VALUES ($1, $2, $3, $4, $5, $6)', [uuidv4(), id, req.headers['x-user-email'] || 'system', 'created', null, insert.rows[0]]);
    res.json(insert.rows[0]);
  });

  router.delete('/lead-lists/:id', async (req, res) => {
    await db.query('DELETE FROM lead_lists WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  // Leads query with cursor pagination
  router.get('/lead-lists/:id/leads', async (req, res) => {
    const { q, statusId, assignedTo, quick, sort = 'updated', cursor, limit = 25 } = req.query;
    const params = [req.params.id];
    let where = 'WHERE list_id = $1';

    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where += ` AND (lower(name) LIKE $${params.length} OR lower(phone_normalized) LIKE $${params.length} OR lower(city) LIKE $${params.length} OR lower(platform) LIKE $${params.length})`;
    }
    if (statusId) {
      params.push(statusId);
      where += ` AND status_id = $${params.length}`;
    }
    if (assignedTo) {
      params.push(assignedTo);
      where += ` AND assigned_to = $${params.length}`;
    }
    if (quick === 'today') {
      where += ' AND follow_up_at::date = CURRENT_DATE';
    } else if (quick === 'overdue') {
      where += ' AND follow_up_at < NOW()';
    }
    if (cursor) {
      params.push(cursor);
      where += ` AND updated_at < $${params.length}`;
    }

    let orderBy = 'updated_at DESC';
    if (sort === 'followup') orderBy = 'follow_up_at DESC NULLS LAST';
    if (sort === 'captureDate') orderBy = 'lead_capture_at DESC';

    params.push(limit);
    const query = `SELECT * FROM leads ${where} ORDER BY ${orderBy} LIMIT $${params.length}`;
    const { rows } = await db.query(query, params);
    const nextCursor = rows.length === Number(limit) ? rows[rows.length - 1].updated_at : null;
    res.json({ items: rows, nextCursor, totalApprox: null });
  });

  // Kanban incremental load
  router.get('/lead-lists/:id/kanban', async (req, res) => {
    const { statusId, cursor, limit = 20, q, assignedTo, quick } = req.query;
    const params = [req.params.id];
    let where = 'WHERE list_id = $1';

    if (statusId) {
      params.push(statusId);
      where += ` AND status_id = $${params.length}`;
    }
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where += ` AND (lower(name) LIKE $${params.length} OR lower(phone_normalized) LIKE $${params.length} OR lower(city) LIKE $${params.length} OR lower(platform) LIKE $${params.length})`;
    }
    if (assignedTo) {
      params.push(assignedTo);
      where += ` AND assigned_to = $${params.length}`;
    }
    if (quick === 'today') {
      where += ' AND follow_up_at::date = CURRENT_DATE';
    } else if (quick === 'overdue') {
      where += ' AND follow_up_at < NOW()';
    }
    if (cursor) {
      params.push(cursor);
      where += ` AND updated_at < $${params.length}`;
    }

    params.push(limit);
    const query = `SELECT * FROM leads ${where} ORDER BY updated_at DESC LIMIT $${params.length}`;
    const { rows } = await db.query(query, params);
    const nextCursor = rows.length === Number(limit) ? rows[rows.length - 1].updated_at : null;
    res.json({ statusId, items: rows, nextCursor });
  });

  router.patch('/leads/:id', async (req, res) => {
    const existing = await db.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const before = existing.rows[0];
    const fields = ['name', 'platform', 'source', 'phone', 'city', 'status_id', 'action_template_id', 'follow_up_at', 'assigned_to', 'notes', 'custom_fields', 'lead_capture_at'];
    const updates = [];
    const paramsUpdate = [];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        paramsUpdate.push(req.body[f]);
        updates.push(`${f} = $${paramsUpdate.length}`);
      }
    });
    if (updates.length === 0) return res.json(before);

    paramsUpdate.push(req.params.id);
    const query = `UPDATE leads SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramsUpdate.length} RETURNING *`;
    const result = await db.query(query, paramsUpdate);
    await db.query('INSERT INTO lead_events (id, lead_id, actor_email, event_type, before, after) VALUES ($1, $2, $3, $4, $5, $6)', [uuidv4(), req.params.id, req.headers['x-user-email'] || 'system', 'updated', before, result.rows[0]]);
    res.json(result.rows[0]);
  });

  router.post('/leads/bulk', async (req, res) => {
    const { leadIds = [], action, payload = {} } = req.body || {};
    if (!Array.isArray(leadIds) || leadIds.length === 0) return res.json({ updated: 0 });
    let updateQuery = '';
    if (action === 'setStatus') updateQuery = 'status_id = $2';
    if (action === 'assign') updateQuery = 'assigned_to = $2';
    if (action === 'setFollowUp') updateQuery = 'follow_up_at = $2';
    if (action === 'delete') updateQuery = 'deleted';

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      if (action === 'delete') {
        await client.query('DELETE FROM leads WHERE id = ANY($1)', [leadIds]);
      } else {
        await client.query(`UPDATE leads SET ${updateQuery}, updated_at = NOW() WHERE id = ANY($1)`, [leadIds, payload.value]);
      }
      await client.query('COMMIT');
      res.json({ updated: leadIds.length });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // Import
  router.post('/lead-lists/:id/import', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'File required' });
    const dedupeMode = req.body?.dedupeMode || 'skip';
    const defaultCountry = req.body?.defaultCountry || '+91';
    const columnMap = req.body?.columnMap ? JSON.parse(req.body.columnMap) : undefined;
    const { rows, errors } = parseLeadFile({ buffer: req.file.buffer, mimetype: req.file.mimetype, originalname: req.file.originalname, dedupeMode, defaultCountry, columnMap });

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = errors.length;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of rows) {
        const { phone_normalized } = row;
        const existing = await client.query('SELECT * FROM leads WHERE list_id = $1 AND phone_normalized = $2', [req.params.id, phone_normalized]);
        if (existing.rows.length > 0) {
          if (dedupeMode === 'skip') {
            skippedCount += 1;
            await client.query('INSERT INTO lead_events (id, lead_id, actor_email, event_type, before, after) VALUES ($1, $2, $3, $4, $5, $6)', [uuidv4(), existing.rows[0].id, req.headers['x-user-email'] || 'system', 'import_skipped', existing.rows[0], existing.rows[0]]);
            continue;
          }
          if (dedupeMode === 'update') {
          const updated = await client.query('UPDATE leads SET name = $1, platform = $2, source = $3, phone = $4, city = $5, custom_fields = $6, lead_capture_at = $7, updated_at = NOW() WHERE id = $8 RETURNING *', [row.name, row.platform, row.platform, row.phone, row.city, row.custom_fields, row.lead_capture_at, existing.rows[0].id]);
            updatedCount += 1;
            await client.query('INSERT INTO lead_events (id, lead_id, actor_email, event_type, before, after) VALUES ($1, $2, $3, $4, $5, $6)', [uuidv4(), existing.rows[0].id, req.headers['x-user-email'] || 'system', 'import_updated', existing.rows[0], updated.rows[0]]);
            continue;
          }
        }

        const leadId = uuidv4();
        const statusRes = await client.query('SELECT id FROM lead_statuses WHERE list_id = $1 ORDER BY sort_order LIMIT 1', [req.params.id]);
        const statusId = statusRes.rows[0]?.id || null;
        const insert = await client.query('INSERT INTO leads (id, list_id, lead_capture_at, name, platform, source, phone, phone_normalized, city, status_id, custom_fields) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', [leadId, req.params.id, row.lead_capture_at, row.name, row.platform, row.platform, row.phone, row.phone_normalized, row.city, statusId, row.custom_fields]);
        await client.query('INSERT INTO lead_events (id, lead_id, actor_email, event_type, before, after) VALUES ($1, $2, $3, $4, $5, $6)', [uuidv4(), leadId, req.headers['x-user-email'] || 'system', 'imported', null, insert.rows[0]]);
        importedCount += 1;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }

    res.json({ importedCount, updatedCount, skippedCount, errors });
  });

  // Export
  router.get('/lead-lists/:id/export', async (req, res) => {
    const { rows } = await db.query(`
      SELECT lead_capture_at, name, platform, source, phone, city, status_id, action_template_id, follow_up_at, assigned_to, notes
      FROM leads WHERE list_id = $1 ORDER BY lead_capture_at DESC
    `, [req.params.id]);
    const header = ['lead_capture_at', 'name', 'platform', 'source', 'phone', 'city', 'status_id', 'action_template_id', 'follow_up_at', 'assigned_to', 'notes'];
    const csv = [header.join(',')].concat(rows.map((r) => header.map((h) => r[h] || '').join(','))).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(csv);
  });

  return router;
};

module.exports = leadRoutes;
