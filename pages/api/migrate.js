const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

const CHECKLIST = [
    {
      id: 'provide_realistico_email',
      label: 'Proveer el realisti.co email y confirmar (migrar tours, plan en Floorfy, próxima fecha de renovación) @Annamaria Anastasia',
    },
    {
      id: 'create_account_and_migrate',
      label: 'Crear cuenta, migrar los tours y dejar suscripción preparada. @Kevin Ramos',
    },
    {
      id: 'confirm_client_activation',
      label: 'Confirmar cliente ha activado bien Floorfy @Annamaria Anastasia',
    },
    {
      id: 'cancel_subscription',
      label: 'Cancelar la subscripción en realistico bd y stripe @Didac @Kevin Ramos',
    },
    {
      id: 'celebration_shot',
      label: 'Chupito de celebración @Annamaria Anastasia @Kevin Ramos @María Leguizamón @sergi @Didac',
    },
  ];


export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  console.log("🔔 Incoming request to /api/migrate");

  if (req.method !== 'POST') {
    console.warn("⚠️ Method not allowed:", req.method);
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let channelId, clientEmail, extraInfo;
  let isSlackCommand = false;

  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    isSlackCommand = true;

    const text = req.body.text || '';
    const userId = req.body.user_id;
    console.log("🧵 Slash command text:", text);

    // Parse text: key=value pairs
    const args = Object.fromEntries(
      [...text.matchAll(/(\w+)=(".*?"|\S+)/g)].map(([_, key, val]) => [key, val.replace(/^"|"$/g, '')])
    );

    channelId = args.channelId || userId; // fallback to user DM
    clientEmail = args.clientEmail || 'E-mail del cliente';
    extraInfo = args.extraInfo || '';
  } else {
    ({ channelId, clientEmail, extraInfo } = req.body);
  }

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
        text: `*Checklist de migración para el cliente:* ${clientEmail}`,
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

    if (isSlackCommand) {
      return res.status(200).send(`✅ Checklist enviada a <@${channelId}>.`);
    }

    return res.status(200).json({ ok: true, ts: result.ts, channel: result.channel });
  } catch (err) {
    console.error("🔥 Error interno:", err);
    return res.status(500).json({ error: 'Error interno', details: err.message });
  }
}