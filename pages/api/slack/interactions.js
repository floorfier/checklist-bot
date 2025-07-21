const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

// Estado simple en memoria (solo para ejemplo)
const taskStatusMap = {}; // { ts: { taskId: 'complete' | 'incomplete', ... } }

function buildBlocksFromStatus(currentStatus) {
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

  // Slack envía payload en un campo que es string JSON, hay que parsear
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

  console.log(`📩 Message from user ${username}: ${taskId}`);

  // Obtener estado actual o inicializar
  const currentStatus = taskStatusMap[message.ts] || {};
  const currentValue = currentStatus[taskId] || 'incomplete';

  // Toggle status
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

    res.status(200).end(); // Ok para Slack
  } catch (error) {
    console.error('Internal error:', error);
    res.status(500).json({ error: 'Error interno', details: error.message });
  }
}