import CHECKLIST from '../../lib/checklist';

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

// Estado simple en memoria (solo ejemplo)
const taskStatusMap = {}; // { ts: { taskId: 'complete' | 'incomplete', ... } }

function buildBlocksFromStatus(currentStatus) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Checklist de migración* (actualizado):',
      },
    },
    { type: 'divider' },
    ...CHECKLIST.map((item) => {
      const done = currentStatus[item.id] === 'complete';
      return {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${done ? '✅ ' : ''}${item.text}`,
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: done ? 'Desmarcar' : '✅ Hecho',
          },
          action_id: item.id,
          value: done ? 'complete' : 'incomplete',
          style: done ? 'danger' : 'primary',
        },
      };
    }),
  ];

  const allCompleted = CHECKLIST.every((item) => currentStatus[item.id] === 'complete');
  if (allCompleted) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🎉 *¡Checklist completa!* ¡Buen trabajo equipo!',
      },
    });
  }

  return blocks;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!req.body.payload) {
    return res.status(400).send('Missing payload');
  }

  let payload;
  try {
    payload = JSON.parse(req.body.payload);
  } catch (err) {
    console.error('Error parsing payload JSON', err);
    return res.status(400).send('Invalid payload JSON');
  }

  const { actions, message, channel, user } = payload;

  if (!actions || actions.length === 0) {
    return res.status(400).send('No actions found');
  }

  const action = actions[0];
  const taskId = action.action_id;

  const username = user?.username || user?.name || 'Unknown user';
  console.log(`📩 Message from user ${username}: toggling task "${taskId}"`);

  // Obtener estado actual o inicializar
  const currentStatus = taskStatusMap[message.ts] || {};
  const currentValue = currentStatus[taskId] || 'incomplete';

  // Alternar estado
  const newValue = currentValue === 'incomplete' ? 'complete' : 'incomplete';
  currentStatus[taskId] = newValue;
  taskStatusMap[message.ts] = currentStatus;

  // Reconstruir bloques con estado actualizado
  const updatedBlocks = buildBlocksFromStatus(currentStatus);

  try {
    const response = await fetch('https://slack.com/api/chat.update', {
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

    const data = await response.json();

    if (!data.ok) {
      console.error('Slack API error:', data);
      return res.status(500).json({ error: 'Error actualizando mensaje', details: data });
    }

    res.status(200).end();
  } catch (error) {
    console.error('Internal error:', error);
    res.status(500).json({ error: 'Error interno', details: error.message });
  }
}
