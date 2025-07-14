export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { type, challenge } = req.body;

  if (type === 'url_verification') {
    return res.status(200).json({ challenge });
  }

  // Aquí iría el manejo de otros tipos de eventos Slack
  return res.status(200).send('OK');
}