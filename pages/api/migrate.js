const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

const CHECKLIST = [
  { id: 'create_account', label: 'Crear cuenta (Anna)' },
  { id: 'migrate_tours', label: 'Migrar tours (Bonsi)' },
  { id: 'add_subscription', label: 'Añadir suscripción (Kevin)' },
  { id: 'notify_client', label: 'Notificar al cliente (Anna)' },
];

export default async function handler(req, res) {
  console.log("🔔 Incoming request to /api/migrate");

  if (req.method !== 'POST') {
    console.warn("⚠️ Method not allowed:", req.method);
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const isSlackCommand = req.headers['content-type']?.includes('application/x-www-form-urlencoded');

  let channelId, clientName, extraInfo;

  if (isSlackCommand) {
    // Parse Slack command
    const bodyText = typeof req.body === 'string' ? req.body : new URLSearchParams(req.body).toString();
    const params = new URLSearchParams(bodyText);
    const text = params.get('text');
    const userId = params.get('user_id'); // fallback if no channelId provided

    console.log("🧵 Slack command received:", text);

    const args = Object.fromEntries(
      [...text.matchAll(/(\w+)=(".*?"|\S+)/g)].map(([_, key, val]) => [key, val.replace(/^"|"$/g, '')])
    );

    channelId = args.channelId || userId;
    clientName = args.clientName || 'Cliente';
    extraInfo = args.extraInfo || '';
  } else {
    // JSON payload
    ({ channelId, clientName, extraInfo } = req.body);
  }

  console.log("📦 Final parsed payload:", { channelId, clientName, extraInfo });

  if (!channelId || !clientName) {
    console.error("❌ Missing required fields");
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
    ...(extraInfo
      ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📌 *Notas adicionales:*\n${extraInfo}`,
          },
        }]
      : []),
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
    const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        text: `Checklist migración para ${clientName}`,
        blocks,
      }),
    });

    const result = await slackRes.json();
    console.log("✅ Slack API response:", result);

    if (!result.ok) {
      console.error("❌ Slack error:", result);
      return res.status(500).json({ error: 'Error enviando mensaje a Slack', details: result });
    }

    return res.status(200).json({ ok: true, ts: result.ts, channel: result.channel });
  } catch (err) {
    console.error("🔥 Error interno:", err);
    return res.status(500).json({ error: 'Error interno', details: err.message });
  }
}