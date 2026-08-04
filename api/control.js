import { kv } from '@vercel/kv';

const DEFAULT_CATEGORIES = ['DB-Casino', 'Onda Chicken', 'Selbstgemacht', 'Penny'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { clientId, action, sessionId, food, categoryName, oldName, newName } = req.body;

    const state = await kv.get('stopwatch') || {
      running: false,
      startTime: null,
      elapsed: 0,
      controllerId: null,
      sessions: [],
      dailyFood: {}
    };
    if (!state.sessions) state.sessions = [];
    if (!state.dailyFood) state.dailyFood = {};

    // Load food categories
    let categories = await kv.get('foodCategories');
    if (!categories || !Array.isArray(categories)) {
      categories = [...DEFAULT_CATEGORIES];
      await kv.set('foodCategories', categories);
    }

    // --- Migration: dailyFood -> session.food ---
    if (state.dailyFood && Object.keys(state.dailyFood).length > 0) {
      let migrated = false;
      state.sessions.forEach(s => {
        if (!s.food && s.start) {
          const dateStr = new Date(s.start).toLocaleDateString('de-DE');
          if (state.dailyFood[dateStr]) {
            s.food = state.dailyFood[dateStr];
            migrated = true;
          }
        }
      });
      if (migrated) {
        delete state.dailyFood;
        state.dailyFood = {};
        await kv.set('stopwatch', state);
      }
    }

    // --- Timer Actions ---
    if (action === 'start') {
      state.running = true;
      state.startTime = Date.now();

    } else if (action === 'stop') {
      const now = Date.now();
      const duration = now - state.startTime;
      state.elapsed = state.elapsed + duration;

      // Store food per session
      const sessionFood = food || 'Unbekannt';
      state.sessions.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7),
        start: state.startTime,
        end: now,
        duration: duration,
        food: sessionFood
      });

      state.running = false;
      state.startTime = null;

    } else if (action === 'cancel') {
      state.running = false;
      state.startTime = null;

    } else if (action === 'delete_session') {
      const sessionIndex = state.sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex !== -1) {
        const deletedDuration = state.sessions[sessionIndex].duration;
        state.sessions.splice(sessionIndex, 1);
        state.elapsed = Math.max(0, state.elapsed - deletedDuration);
      }

    // --- Per-session food update ---
    } else if (action === 'update_session_food') {
      const session = state.sessions.find(s => s.id === sessionId);
      if (session) {
        session.food = food || 'Unbekannt';
      } else {
        return res.status(404).json({ success: false, error: 'Session nicht gefunden' });
      }

    // --- Category CRUD ---
    } else if (action === 'add_category') {
      const name = (categoryName || '').trim();
      if (!name) {
        return res.status(400).json({ success: false, error: 'Kategoriename darf nicht leer sein' });
      }
      if (name.length > 50) {
        return res.status(400).json({ success: false, error: 'Kategoriename darf maximal 50 Zeichen haben' });
      }
      if (categories.some(c => c.toLowerCase() === name.toLowerCase())) {
        return res.status(400).json({ success: false, error: 'Kategorie existiert bereits' });
      }
      categories.push(name);
      await kv.set('foodCategories', categories);

    } else if (action === 'rename_category') {
      const trimmedOld = (oldName || '').trim();
      const trimmedNew = (newName || '').trim();
      if (!trimmedNew) {
        return res.status(400).json({ success: false, error: 'Neuer Name darf nicht leer sein' });
      }
      if (trimmedNew.length > 50) {
        return res.status(400).json({ success: false, error: 'Name darf maximal 50 Zeichen haben' });
      }
      const idx = categories.findIndex(c => c === trimmedOld);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Kategorie nicht gefunden' });
      }
      if (categories.some(c => c.toLowerCase() === trimmedNew.toLowerCase() && c !== trimmedOld)) {
        return res.status(400).json({ success: false, error: 'Kategorie mit diesem Namen existiert bereits' });
      }
      categories[idx] = trimmedNew;
      // Update all sessions referencing the old name
      state.sessions.forEach(s => {
        if (s.food === trimmedOld) {
          s.food = trimmedNew;
        }
      });
      await kv.set('foodCategories', categories);

    } else if (action === 'delete_category') {
      const name = (categoryName || '').trim();
      const idx = categories.findIndex(c => c === name);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Kategorie nicht gefunden' });
      }
      categories.splice(idx, 1);
      await kv.set('foodCategories', categories);

    } else if (action === 'set_food') {
      // Legacy support - no longer used by new frontend but keep for safety
      // Do nothing
    }

    await kv.set('stopwatch', state);

    return res.status(200).json({
      success: true,
      state: {
        running: state.running,
        startTime: state.startTime,
        elapsed: state.elapsed,
        sessions: state.sessions,
        dailyFood: state.dailyFood
      },
      categories: categories
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'KV connection failed' });
  }
}
