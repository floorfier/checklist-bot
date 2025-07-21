const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

const CHECKLIST = [
  {
    id: 'provide_realistico_email',
    text: '1. Proveer el realisti.co email y confirmar (migrar tours, plan en Floorfy, próxima fecha de renovación)  @Annamaria Anastasia',
  },
  {
    id: 'create_account_migrate',
    text: '2. Crear cuenta, migrar los tours y dejar suscripción preparada. @Kevin Ramos',
  },
  {
    id: 'confirm_activation',
    text: '3. Confirmar cliente ha activado bien Floorfy @Annamaria Anastasia',
  },
  {
    id: 'cancel_subscriptions',
    text: '4. Cancelar la suscripción en realistico bd y Stripe @Didac @Kevin Ramos',
  },
  {
    id: 'celebration_shot',
    text: '5. 🥂 Chupito de celebración @Annamaria Anastasia @Kevin Ramos @María Leguizamón @sergi @Didac',
  },
];

export default async function handler(req, res) {
  console.log("🔔 Incoming request to /api/migrate");

  if (req.method !== 'POST') {
    console.warn("⚠️ Method not allowed:", req.method);
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { channelId, clientEmail, extraInfo } = req.body;
  console.log("📦 Payload received:", { channelId, clientEmail, extraInfo });

  if (!channelId || !clientEmail) {
    console.error("❌ Missing required fields");
    return res.status(400).json({ error: 'Faltan channelId o clientEmail' });
  }

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Checklist de migración para:* ${clientEmail}`,
      },
    },
    ...(extraInfo
      ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📌 *Notas adicionales:*\n${extraInfo}`,
            },
          },
        ]
      : []),
    { type: 'divider' },
    ...CHECKLIST.map((item) => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: item.text,
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '✅ Hecho',
        },
        action_id: item.id,
        value: 'incomplete',
        style: 'primary',
      },
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
        text: `Checklist migración para ${clientEmail}`,
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