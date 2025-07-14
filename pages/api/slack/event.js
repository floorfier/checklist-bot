export const config = {
  api: {
    bodyParser: true, // aseguramos que Next.js parsea el body JSON
  },
};

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  console.log('BODY:', req.body); // para debug en logs de Vercel

  const { type, challenge } = req.body;

  if (type === 'url_verification') {
    return res.status(200).send(challenge);
  }

  return res.status(200).end();
}
