// lib/getSlackUsername.js
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

export async function getSlackUsername(userId) {
    if (!userId) return 'unknown';

    try {
        const res = await fetch('https://slack.com/api/users.info', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SLACK_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user: userId }),
        });

        const data = await res.json();

        if (!data.ok) {
        console.warn(`⚠️ Slack API error for user ${userId}:`, data.error);
        return 'unknown';
        }

        const { profile } = data.user;
        return profile.display_name || profile.real_name || 'unknown';
    } catch (err) {
        console.warn(`⚠️ Failed to fetch Slack username for ${userId}:`, err.message);
        return 'unknown';
    }
}