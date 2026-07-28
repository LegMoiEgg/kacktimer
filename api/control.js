import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { clientId, action } = req.body;

    const state = await kv.get('stopwatch') || {
      running: false,
      startTime: null,
      elapsed: 0,
      controllerId: null,
      sessions: []
    };
    if (!state.sessions) state.sessions = [];

    if (clientId !== state.controllerId) {
      return res.status(403).json({ success: false, error: 'Not the current controller' });
    }

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
    }

    await kv.set('stopwatch', state);

    return res.status(200).json({
      success: true,
      state: {
        running: state.running,
        startTime: state.startTime,
        elapsed: state.elapsed,
        sessions: state.sessions
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'KV connection failed' });
  }
}
