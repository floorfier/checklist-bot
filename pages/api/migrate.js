import { CHECKLIST } from '../lib/checklist.js';
import { getSlackUsername } from '../lib/getSlackUsername.js';
import { taskStatusMap } from '../lib/taskStatusMap.js';

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

// Función que crea los bloques para el mensaje Slack
function buildSlackBlocks({ clientEmail, plan, renewalDate, notes }) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🚀 Nueva migración de cliente de realisti.co*',
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*📧 Email:*\n${clientEmail}`,
        },
        {
          type: 'mrkdwn',
          text: `*📅 Fecha de renovación:*\n${renewalDate || 'No especificada'}`,
        },
        {
          type: 'mrkdwn',
          text: `*💼 Plan contratado:*\n${plan || 'No especificado'}`,
        },
      ],
    },
  ];

  if (notes) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📝 *Notas adicionales:*\n${notes}`,
      },
    });
  }

  blocks.push({ type: 'divider' });

  blocks.push(
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
    }))
  );

  return blocks;
}

export default async function handler(req, res) {
  console.log("🔔 Incoming request to /api/migrate");

  if (req.method !== 'POST') {
    console.warn("⚠️ Method not allowed:", req.method);
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let { channelId, clientEmail, plan, renewalDate, notes, userId } = req.body;

  // Parsing Slack slash command text if needed
  if (!channelId && typeof req.body.text === 'string') {
    const args = Object.fromEntries(
      req.body.text.match(/(\w+)=("[^"]+"|\S+)/g)?.map(pair => {
        const [key, value] = pair.split('=');
        return [key, value.replace(/^"|"$/g, '')];
      }) || []
    );

    channelId = args.channelId;
    clientEmail = args.clientEmail;
    plan = args.plan;
    renewalDate = args.renewalDate;
    notes = args.notes?.replace(/\\n/g, '\n');
    userId = args.userId || userId;
  }

  const slackUserId = userId || req.body.user_id || 'unknown user';

  console.log("📦 Final values:", { channelId, clientEmail, plan, renewalDate, notes, slackUserId });

  const username = await getSlackUsername(slackUserId);

  if (!channelId || !clientEmail) {
    console.error(`❌ Missing required fields from ${username} (${slackUserId})`, {
      channelId,
      clientEmail,
      plan,
      renewalDate,
      notes,
    });
    return res.status(400).json({ error: 'Faltan channelId o clientEmail' });
  }

  const blocks = buildSlackBlocks({ clientEmail, plan, renewalDate, notes });

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
    taskStatusMap[result.ts] = CHECKLIST.reduce((acc, item) => {
      acc[item.id] = 'incomplete';
      return acc;
    }, { _clientEmail: clientEmail });

    console.log("✅ Slack API response:", result);

    if (!result.ok) {
      console.error(`❌ Slack error para usuario ${slackUserId}:`, result);
      return res.status(500).json({ error: 'Error enviando mensaje a Slack', details: result });
    }

    return res.status(200).json({ ok: true, ts: result.ts, channel: result.channel });
  } catch (err) {
    console.error(`🔥 Error interno para usuario ${slackUserId}:`, err);
    return res.status(500).json({ error: 'Error interno', details: err.message });
  }
}