import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const { clientId } = req.query;

    // Read current state from KV, initialize default if not exists
    let state = await kv.get('stopwatch') || {
      running: false,
      startTime: null,
      elapsed: 0,
      controllerId: null
    };

    // Controller registration: if clientId is provided, register as new controller
    if (clientId) {
      state.controllerId = clientId;
      await kv.set('stopwatch', state);
    }

    // Return state with isController field
    res.status(200).json({
      running: state.running,
      startTime: state.startTime,
      elapsed: state.elapsed,
      controllerId: state.controllerId,
      isController: clientId ? clientId === state.controllerId : false
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'KV connection failed' });
  }
}
