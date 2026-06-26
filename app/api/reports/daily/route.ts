import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "워크스페이스 ID가 필요합니다." }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { workspaceId },
    });

    if (!project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const doneTasks = await prisma.task.findMany({
      where: {
        projectId: project.id,
        status: "Done",
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    if (doneTasks.length === 0) {
      return NextResponse.json({
        report: "💡 **오늘 완료된 작업이 없습니다.**\n\n칸반 보드에서 작업을 완료(`Done`) 상태로 변경하면 AI가 데일리 요약 보고서를 작성해 드립니다.",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        report: `💡 **AI 요약 기능 제한** (GEMINI_API_KEY 미설정)\n\n오늘 완료된 작업 목록입니다:\n${doneTasks.map(t => `- [${t.type}] **${t.title}** (담당: ${t.assigneeId})`).join("\n")}`,
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }, { apiVersion: "v1" });

    const taskSummaries = doneTasks
      .map(
        (t, idx) =>
          `${idx + 1}. [${t.type}] 제목: ${t.title} | 담당: ${t.assigneeId} | 설명: ${t.description || "설명 없음"}`
      )
      .join("\n");

    const prompt = `
당신은 전공자와 비전공자가 혼합된 AI 부트캠프 대학생 프로젝트의 스크럼 마스터 및 협업 전문가입니다.
오늘 완료된 다음 태스크 목록을 분석하여, 비기술 직군(기획자, 디자이너)과 전공자(개발자, AI 연구원) 모두가 직관적으로 프로젝트의 진행 흐름을 파악할 수 있는 **일일 프로젝트 요약 리포트 (Daily Wrap-up)**를 한국어로 정성스럽게 작성해 주세요.

[완료된 태스크 목록]
${taskSummaries}

[리포트 작성 지침]
1. 친근하고 부드러운 한국어 구어체(~했습니다, ~입니다)를 사용하십시오.
2. 기술적인 은어 및 AI/코딩 전문 용어(예: Git merge, 하이퍼파라미터 등)는 비전공자도 쉽게 이해할 수 있도록 괄호 안에 간단한 해설이나 친근한 언어로 대체/보완해서 설명해 주세요.
3. 리포트는 다음 구조의 마크다운 형식으로 출력해 주세요:
   - ## 🎯 오늘의 프로젝트 핵심 요약 (오늘 전체적으로 어떤 성과가 있었는지 2~3줄 요약)
   - ## 📈 역할군별 세부 진행 상황 (기획, 데이터, 모델, 개발 등 해당되는 분류별로 분류하여 요약)
   - ## 💡 내일을 위한 협업 제안 (완료된 작업들을 고려하여 내일 팀원들이 모여서 논의하거나 페어링해야 할 활동 추천)

다른 설명이나 잡담 없이 오직 마크다운 형식으로만 반환해 주세요.
`;

    const result = await model.generateContent(prompt);
    const reportText = result.response.text();

    // 디스코드 실시간 알림 연동
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId }
      });
      const webhookUrl = workspace?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;

      if (webhookUrl) {
        const { sendDiscordNotification } = await import("@/lib/discord");
        const summarySnippet = reportText.length > 800 ? `${reportText.substring(0, 800)}...` : reportText;
        await sendDiscordNotification({
          title: "📊 오늘의 AI 데일리 프로젝트 랩업 보고서가 도착했습니다!",
          description: summarySnippet,
          color: 1752220,
        }, webhookUrl);
      }
    } catch (discordErr) {
      console.error("Discord daily report notification failed:", discordErr);
    }

    return NextResponse.json({ report: reportText });
  } catch (error: any) {
    console.error("Daily Report Error:", error);
    return NextResponse.json({ error: "보고서를 생성하지 못했습니다.", details: error.message }, { status: 500 });
  }
}
