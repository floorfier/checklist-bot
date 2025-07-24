import { CHECKLIST } from '../../lib/checklist.js';
import { taskStatusMap } from '../../lib/taskStatusMap.js';

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

function buildBlocksFromStatus(currentStatus, clientEmail = 'Cliente desconocido') {
  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Checklist de migración para:* ${clientEmail}` },
    },
  ];

  const extraInfo = currentStatus._extraInfo;
  if (extraInfo) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: extraInfo }],
    });
  }

  blocks.push({ type: 'divider' });

  for (const item of CHECKLIST) {
    const done = currentStatus[item.id] === 'complete';
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `${done ? '✅ ' : ''}${item.text}` },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: done ? 'Desmarcar' : '✅ Hecho' },
        action_id: item.id,
        value: done ? 'complete' : 'incomplete',
        style: done ? 'danger' : 'primary',
      },
    });
  }

  const allCompleted = CHECKLIST.every(item => currentStatus[item.id] === 'complete');
  if (allCompleted) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '🎉 *¡Checklist completa!* ¡Buen trabajo equipo!' },
    });
  }

  return blocks;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!req.body.payload) return res.status(400).send('Missing payload');

  let payload;
  try {
    payload = JSON.parse(req.body.payload);
  } catch {
    return res.status(400).send('Invalid payload JSON');
  }

  const { actions, message, channel, user } = payload;
  if (!actions?.length) return res.status(400).send('No actions found');

  const action = actions[0];
  const taskId = action.action_id;

  const currentStatus = taskStatusMap[message.ts] || {};

  const clientEmail = currentStatus._clientEmail || 'Cliente desconocido';
  const extraInfo = currentStatus._extraInfo || null;

  // Alternar estado
  const currentValue = currentStatus[taskId] || 'incomplete';
  currentStatus[taskId] = currentValue === 'incomplete' ? 'complete' : 'incomplete';

  currentStatus._clientEmail = clientEmail;
  if (extraInfo) currentStatus._extraInfo = extraInfo;

  taskStatusMap[message.ts] = currentStatus;

  const updatedBlocks = buildBlocksFromStatus(currentStatus, clientEmail);

  try {
    const slackRes = await fetch('https://slack.com/api/chat.update', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channel.id,
        ts: message.ts,
        blocks: updatedBlocks,
        text: 'Checklist actualizada',
      }),
    });

    const slackData = await slackRes.json();
    if (!slackData.ok) {
      return res.status(500).send('Error actualizando mensaje en Slack');
    }

    return res.status(200).send('');
  } catch (error) {
    return res.status(500).send('Error interno');
  }
}