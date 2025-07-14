export default function handler(req, res) {
  console.log("🔔 Incoming Slack event:", req.body);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { type, challenge, event } = req.body;

  if (type === 'url_verification') {
    return res.status(200).json({ challenge });
  }

  if (type === 'event_callback') {
    if (event.type === 'message' && !event.bot_id) {
      // Solo mensajes que no son de bots
      console.log(`📩 Message from user ${event.user}: ${event.text}`);
      // Aquí podrías responder, procesar o almacenar el mensaje
    }
    return res.status(200).send('OK');
  }

  return res.status(200).send('No event handled');
}