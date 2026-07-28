import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { clientId, action, sessionId, date, food } = req.body;

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

    // Removed the controller restriction so multiple people can control it
    // without stealing the session from each other.

    if (action === 'start') {
      state.running = true;
      state.startTime = Date.now();
    } else if (action === 'stop') {
      const now = Date.now();
      const duration = now - state.startTime;
      state.elapsed = state.elapsed + duration;
      
      state.sessions.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7),
        start: state.startTime,
        end: now,
        duration: duration
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
    } else if (action === 'set_food') {
      if (date && food !== undefined) {
        state.dailyFood[date] = food;
      }
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
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'KV connection failed' });
  }
}
