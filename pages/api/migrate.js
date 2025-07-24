import { CHECKLIST } from '../lib/checklist.js';
import { getSlackUsername } from '../lib/getSlackUsername.js';
import { taskStatusMap } from '../lib/taskStatusMap.js';

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let { channelId, clientEmail, plan, renewalDate, notes, extraInfo } = req.body;

  // Compatibilidad con Slack Slash Command (parsing texto)
  if (!channelId && typeof req.body.text === 'string') {
    const args = Object.fromEntries(
      req.body.text.match(/(\w+)=("[^"]+"|\S+)/g)?.map(pair => {
        const [key, value] = pair.split('=');
        return [key, value.replace(/^"|"$/g, '')];
      }) || []
    );
    channelId = args.channelId;
    clientEmail = args.clientEmail;
    plan = args.plan || plan;
    renewalDate = args.renewalDate || renewalDate;
    notes = args.notes ? args.notes.replace(/\\n/g, '\n') : notes;
  }

  if (!channelId || !clientEmail) {
    return res.status(400).json({ error: 'Faltan channelId o clientEmail' });
  }

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Nueva migración de cliente de realisti.co:* ${clientEmail}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Plan contratado:*\n${plan || 'No especificado'}` },
        { type: 'mrkdwn', text: `*Fecha de renovación:*\n${renewalDate || 'No especificada'}` },
      ],
    },
  ];

  if (notes) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📌 *Notas adicionales:*\n${notes}`,
      },
    });
  } else if (extraInfo) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📌 *Notas adicionales:*\n${extraInfo}`,
      },
    });
  }

  blocks.push({ type: 'divider' });

  blocks.push(
    ...CHECKLIST.map(item => ({
      type: 'section',
      text: { type: 'mrkdwn', text: item.text },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: '✅ Hecho' },
        action_id: item.id,
        value: 'incomplete',
        style: 'primary',
      },
    }))
  );

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
    }, { _clientEmail: clientEmail, _extraInfo: notes || extraInfo || '' });

    if (!result.ok) {
      return res.status(500).json({ error: 'Error enviando mensaje a Slack', details: result });
    }

    return res.status(200).json({ ok: true, ts: result.ts, channel: result.channel });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno', details: err.message });
  }
}