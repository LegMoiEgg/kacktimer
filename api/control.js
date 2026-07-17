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
      controllerId: null
    };

    if (clientId !== state.controllerId) {
      return res.status(403).json({ success: false, error: 'Not the current controller' });
    }

    if (action === 'start') {
      state.running = true;
      state.startTime = Date.now();
    } else if (action === 'stop') {
      state.elapsed = state.elapsed + (Date.now() - state.startTime);
      state.running = false;
      state.startTime = null;
    }

    await kv.set('stopwatch', state);

    return res.status(200).json({
      success: true,
      state: {
        running: state.running,
        startTime: state.startTime,
        elapsed: state.elapsed
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'KV connection failed' });
  }
}
