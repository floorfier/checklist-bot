// /api/slack/events.js
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { type, challenge } = req.body;

    if (type === 'url_verification') {
      return res.status(200).send(challenge); // Verificación inicial de Slack
    }

    // Aquí vendrán eventos tipo "message", "app_mention", etc.
    return res.status(200).end();
  }

  res.setHeader('Allow', 'POST');
  res.status(405).end('Method Not Allowed');
}
