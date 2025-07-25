import { CHECKLIST } from '../../lib/checklist.js';
import { createClient } from '@supabase/supabase-js';

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Construye los bloques Slack con historial visual.
 */
function buildBlocksFromStatus(currentStatus, clientEmail = 'Cliente desconocido', checkHistory = {}) {
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

    const history = checkHistory[item.id];
    if (history?.length > 0) {
      const last = history[history.length - 1];
      const user = last.username || `<@${last.by}>`;
      const timestamp = new Date(last.at);
      const now = new Date();
      const diffMin = Math.round((now - timestamp) / 60000);
      const relative = diffMin < 1
        ? 'hace unos segundos'
        : diffMin < 60
        ? `hace ${diffMin} min`
        : `hace ${Math.floor(diffMin / 60)}h`;

      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_Última acción por_ *${user}* _→_ *${last.to === 'complete' ? '✅ Hecho' : '⏳ Pendiente'}* · ${relative}`,
          },
        ],
      });
    }
  }

  const allCompleted = CHECKLIST.every(item => currentStatus[item.id] === 'complete');
  if (allCompleted) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '🎉 *¡Checklist completa!* ¡Buen trabajo equipo! 🥂 Chupito de celebración' },
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

  res.status(200).send(); // Siempre responder de inmediato a Slack

  const { actions, user, message } = payload;
  const channelId = message?.channel || payload.channel?.id;
  const messageTs = message?.ts;

  if (!actions?.length || !channelId || !messageTs) {
    console.error('Faltan datos necesarios para actualizar el mensaje');
    return;
  }

  const action = actions[0];
  const taskId = action.action_id;

  // 1. Obtener checklist desde Supabase
  const { data: migration, error } = await supabase
    .from('migrations')
    .select('id, email, extra_info, check_status, check_history')
    .eq('slack_ts', messageTs)
    .single();

  if (error || !migration) {
    console.error('No se encontró la checklist:', error);
    return;
  }

  const taskStatus = migration.check_status || {};
  const checkHistory = migration.check_history || {};

  // 2. Alternar estado
  const currentValue = taskStatus[taskId] || 'incomplete';
  const newValue = currentValue === 'incomplete' ? 'complete' : 'incomplete';
  taskStatus[taskId] = newValue;

  // 3. Agregar entrada al historial
  const username = payload.user?.username || '';
  const userId = payload.user?.id;
  const now = new Date().toISOString();

  if (!checkHistory[taskId]) checkHistory[taskId] = [];

  checkHistory[taskId].push({
    at: now,
    by: userId,
    username,
    to: newValue,
  });

  // 4. Actualizar Supabase
  const { error: updateError } = await supabase
    .from('migrations')
    .update({
      check_status: taskStatus,
      check_history: checkHistory,
    })
    .eq('id', migration.id);

  if (updateError) {
    console.error('Error actualizando Supabase:', updateError);
    return;
  }

  // 5. Construir nuevos bloques
  const updatedBlocks = buildBlocksFromStatus(taskStatus, migration.email, checkHistory);

  // 6. Actualizar mensaje en Slack
  try {
    const slackRes = await fetch('https://slack.com/api/chat.update', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        ts: messageTs,
        blocks: updatedBlocks,
        text: 'Checklist actualizada',
      }),
    });

    const slackResult = await slackRes.json();
    if (!slackResult.ok) {
      console.error('Slack update error:', slackResult);
    }
  } catch (err) {
    console.error('Error actualizando mensaje en Slack:', err);
  }
}