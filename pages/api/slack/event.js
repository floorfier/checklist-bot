export const config = {
  api: {
    bodyParser: true,
  },
};

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const { type, challenge } = req.body;

  console.log('Slack event:', req.body); // para debug en Vercel

  if (type === 'url_verification') {
    // Responder exactamente con el challenge, texto plano
    return res.status(200).send(challenge);
  }

  // Otros eventos
  return res.status(200).end();
}