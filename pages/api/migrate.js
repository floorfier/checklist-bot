const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

const CHECKLIST = [
  { id: 'create_account', label: 'Crear cuenta (Anna)' },
  { id: 'migrate_tours', label: 'Migrar tours (Bonsi)' },
  { id: 'add_subscription', label: 'Añadir suscripción (Kevin)' },
  { id: 'notify_client', label: 'Notificar al cliente (Anna)' },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { channelId, clientName } = req.body;
  if (!channelId || !clientName) {
    return res.status(400).json({ error: 'Faltan channelId o clientName' });
  }

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Checklist de migración para cliente:* ${clientName}`,
      },
    },
    { type: 'divider' },
    ...CHECKLIST.map((item) => ({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: item.label,
          },
          action_id: item.id,
          value: 'incomplete',
          style: 'primary',
        },
      ],
    })),
  ];

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        blocks,
        text: `Checklist migración para ${clientName}`,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      return res.status(500).json({ error: 'Error enviando mensaje a Slack', details: data });
    }

    res.status(200).json({ ok: true, ts: data.ts, channel: data.channel });
  } catch (error) {
    res.status(500).json({ error: 'Error interno', details: error.message });
  }
}