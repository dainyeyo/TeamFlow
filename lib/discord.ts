export async function sendDiscordNotification(
  embed: {
    title: string;
    description: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
  },
  customWebhookUrl?: string
) {
  const webhookUrl = customWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("⚠️ 디스코드 웹훅 URL이 설정되지 않아 알림 발송을 생략합니다.");
    return;
  }

  try {
    const payload = {
      username: "TeamFlow AI 알림",
      embeds: [
        {
          ...embed,
          color: embed.color || 9390288, // 기본 보라색 (Neon Purple)
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("Discord Webhook 전송 에러:", res.statusText);
    }
  } catch (err) {
    console.error("Discord Notification error:", err);
  }
}
