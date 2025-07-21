// Endpoint para manejar el slash command /realisticomigration

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { channel_id, text, user_name } = req.body;

  console.log('⚡ Slash command /realisticomigration triggered:', { channel_id, text, user_name });

  try {
    const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

    const checklistBlocks = [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Checklist de migración para:* ${text || user_name}` },
      },
      { type: 'divider' },
      // Aquí tus bloques checklist
    ];

    const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channel_id,
        blocks: checklistBlocks,
        text: `Checklist migración para ${text || user_name}`,
      }),
    });

    const data = await slackRes.json();

    if (!data.ok) {
      console.error('Slack API error:', data);
      return res.status(500).json({ error: 'Error enviando mensaje a Slack' });
    }

    return res.status(200).send('Checklist creada y enviada a Slack ✅');
  } catch (error) {
    console.error('Error interno:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
}