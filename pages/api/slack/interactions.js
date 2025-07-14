const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

// Guardar estado simple en memoria para ejemplo.
// En producción, guarda esto en DB o caché
const taskStatusMap = {}; // { ts: { taskId: 'complete' | 'incomplete', ... } }

function buildBlocksFromStatus(currentStatus) {
  const CHECKLIST = [
    { id: 'create_account', label: 'Crear cuenta (Anna)' },
    { id: 'migrate_tours', label: 'Migrar tours (Bonsi)' },
    { id: 'add_subscription', label: 'Añadir suscripción (Kevin)' },
    { id: 'notify_client', label: 'Notificar al cliente (Anna)' },
  ];

  return [
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
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: `${done ? '✅ ' : ''}${item.label}`,
            },
            action_id: item.id,
            value: done ? 'complete' : 'incomplete',
            style: done ? 'danger' : 'primary',
          },
        ],
      };
    }),
  ];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const payload = JSON.parse(req.body.payload);
  const { actions, message, channel } = payload;

  if (!actions || actions.length === 0) {
    return res.status(400).send('No actions found');
  }

  const action = actions[0];
  const taskId = action.action_id;

  // Obtener estado actual o inicializar
  const currentStatus = taskStatusMap[message.ts] || {};
  const currentValue = currentStatus[taskId] || 'incomplete';

  // Cambiar estado
  const newValue = currentValue === 'incomplete' ? 'complete' : 'incomplete';
  currentStatus[taskId] = newValue;
  taskStatusMap[message.ts] = currentStatus;

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
      return res.status(500).json({ error: 'Error actualizando mensaje', details: data });
    }

    res.status(200).send(); // vacía para Slack
  } catch (error) {
    res.status(500).json({ error: 'Error interno', details: error.message });
  }
}