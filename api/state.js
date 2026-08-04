import { kv } from '@vercel/kv';

const DEFAULT_CATEGORIES = ['DB-Casino', 'Onda Chicken', 'Selbstgemacht', 'Penny'];

export default async function handler(req, res) {
  try {
    const { clientId } = req.query;

    // Read current state from KV, initialize default if not exists
    let state = await kv.get('stopwatch') || {
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
        state.dailyFood = {};
        try {
          await kv.set('stopwatch', state);
        } catch (e) {
          // Migration write failed - return unmigrated state, retry next time
        }
      }
    }

    // Controller registration: if clientId is provided, register as new controller
    if (clientId) {
      state.controllerId = clientId;
      await kv.set('stopwatch', state);
    }

    // Return state with categories
    res.status(200).json({
      running: state.running,
      startTime: state.startTime,
      elapsed: state.elapsed,
      sessions: state.sessions,
      dailyFood: state.dailyFood,
      controllerId: state.controllerId,
      isController: clientId ? clientId === state.controllerId : false,
      categories: categories
    });
  } catch (error) {
    // Fallback with default categories
    res.status(500).json({ success: false, error: 'KV connection failed', categories: DEFAULT_CATEGORIES });
  }
}
