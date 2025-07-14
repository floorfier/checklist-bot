import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const rawBody = await new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
  });

  const params = new URLSearchParams(rawBody);
  const cliente = params.get('text') || 'clienteX';

  const token = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID;

  const checklist = `
:clipboard: *Checklist migración para ${cliente}:*

:white_large_square: <@UANNA> - Crear cuenta  
:white_large_square: <@UBONSI> - Migrar tours  
:white_large_square: <@UKEVIN> - Añadir suscripción  
:white_large_square: <@UKEVIN> - Notificar al cliente
`;

  try {
    const result = await axios.post('https://slack.com/api/chat.postMessage', {
      channel: channelId,
      text: checklist,
      mrkdwn: true,
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!result.data.ok) {
      console.error(result.data);
      return res.status(500).send('Slack API error');
    }

    res.status(200).send('');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
}
