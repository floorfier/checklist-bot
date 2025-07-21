import { CHECKLIST } from './checklist.js';

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

export default async function handler(req, res) {
  console.log("🔔 Incoming request to /api/migrate");

  if (req.method !== 'POST') {
    console.warn("⚠️ Method not allowed:", req.method);
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let { channelId, clientEmail, extraInfo } = req.body;

  // 👇 Si viene desde un Slack Slash Command, parseamos el campo "text"
  if (!channelId && typeof req.body.text === 'string') {
    console.log('🔍 Parsing text from Slack command:', req.body.text);

    const args = Object.fromEntries(
      req.body.text.match(/(\w+)=("[^"]+"|\S+)/g)?.map(pair => {
        const [key, value] = pair.split('=');
        return [key, value.replace(/^"|"$/g, '')];
      }) || []
    );

    channelId = args.channelId;
    clientEmail = args.clientEmail;
    extraInfo = args.extraInfo?.replace(/\\n/g, '\n');
  }

  console.log("📦 Final values:", { channelId, clientEmail, extraInfo });

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