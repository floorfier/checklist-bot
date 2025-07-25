import { supabase } from '../lib/supabaseClient.js';
import { CHECKLIST } from '../lib/checklist.js';
import { getSlackUsername } from '../lib/getSlackUsername.js';

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let { channelId, clientEmail, plan, renewalDate, extraInfo, userId } = req.body;

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
    extraInfo = args.extraInfo?.replace(/\\n/g, '\n');
    userId = args.userId || userId;
  }

  if (!channelId || !clientEmail) {
    return res.status(400).json({ error: 'Faltan channelId o clientEmail' });
  }

  const slackUserId = userId || req.body.user_id || 'unknown user';
  const username = await getSlackUsername(slackUserId);

  // Buscar si ya existe
  let { data: existing, error: fetchError } = await supabase
    .from('migrations')
    .select('*')
    .eq('email', clientEmail)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error fetching migration:', fetchError);
    return res.status(500).json({ error: 'Error consultando base de datos' });
  }

  // Si no existe, crear nueva
  if (!existing) {
    const initialCheckStatus = CHECKLIST.reduce((acc, item) => {
      acc[item.id] = 'incomplete';
      return acc;
    }, {});

    const { data: insertData, error: insertError } = await supabase
      .from('migrations')
      .insert({
        email: clientEmail,
        plan,
        renewal_date: renewalDate,
        extra_info: extraInfo,
        check_status: initialCheckStatus,
        slack_channel: channelId,
        slack_ts: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting migration:', insertError);
      return res.status(500).json({ error: 'Error guardando en base de datos' });
    }

    existing = insertData;
  } else {
    // Si ya existe, actualizar campos opcionales
    await supabase
      .from('migrations')
      .update({
        plan: plan || existing.plan,
        renewal_date: renewalDate || existing.renewal_date,
        extra_info: extraInfo || existing.extra_info,
        slack_channel: channelId || existing.slack_channel,
      })
      .eq('email', clientEmail);

    // Refrescar datos tras actualización
    const { data: refreshed } = await supabase
      .from('migrations')
      .select('*')
      .eq('email', clientEmail)
      .single();
    existing = refreshed;
  }

  // Construcción del mensaje Slack
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🚀 Nueva migración de cliente de realisti.co',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `📧 *Email:*\n${existing.email}` },
        { type: 'mrkdwn', text: `🎯 *Plan contratado:*\n${existing.plan || 'No especificado'}` },
        { type: 'mrkdwn', text: `🗓️ *Fecha de renovación:*\n${existing.renewal_date || 'No especificada'}` },
      ],
    },
    ...(existing.extra_info
      ? [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `📝 *Notas adicionales:*\n${existing.extra_info}` },
          },
        ]
      : []),
    { type: 'divider' },
    ...CHECKLIST.map((item) => ({
      type: 'section',
      text: { type: 'mrkdwn', text: item.text },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: existing.check_status?.[item.id] === 'complete' ? '✅ Hecho' : '⏳ Pendiente',
        },
        action_id: item.id,
        value: existing.check_status?.[item.id] === 'complete' ? 'complete' : 'incomplete',
        style: existing.check_status?.[item.id] === 'complete' ? 'primary' : undefined,
      },
    })),
  ];

  const slackBody = {
    channel: channelId,
    text: `Checklist migración para ${clientEmail}`,
    blocks,
  };

  let slackRes;
  if (!existing.slack_ts) {
    slackRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackBody),
    });

    const slackResult = await slackRes.json();
    if (!slackResult.ok) {
      console.error('Error Slack postMessage:', slackResult);
      return res.status(500).json({ error: 'Error enviando mensaje a Slack', details: slackResult });
    }

    await supabase
      .from('migrations')
      .update({ slack_ts: slackResult.ts })
      .eq('email', clientEmail);

    existing.slack_ts = slackResult.ts;
  } else {
    slackBody.ts = existing.slack_ts;

    slackRes = await fetch('https://slack.com/api/chat.update', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackBody),
    });

    const slackResult = await slackRes.json();
    if (!slackResult.ok) {
      console.error('Error Slack chat.update:', slackResult);
      return res.status(500).json({ error: 'Error actualizando mensaje Slack', details: slackResult });
    }
  }

  return res.status(200).json({ ok: true, ts: existing.slack_ts, channel: channelId });
}