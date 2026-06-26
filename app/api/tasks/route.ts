import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// 외래 키 제약조건을 만족하기 위해 워크스페이스와 프로젝트를 조회하거나 생성하는 헬퍼 함수
async function getOrCreateProjectForWorkspace(workspaceId?: string) {
  let workspace = null;
  if (workspaceId) {
    workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
  }

  if (!workspace) {
    workspace = await prisma.workspace.findFirst();
    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          name: "Default AI Bootcamp Workspace",
          inviteCode: "DFLT10",
        },
      });
    }
  }

  let project = await prisma.project.findFirst({
    where: { workspaceId: workspace.id },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: "AI MVP Team Project",
        description: "전공자와 비전공자가 협업하는 메인 AI 프로젝트 보드",
        workspaceId: workspace.id,
      },
    });
  }

  return project;
}

// 1. 태스크 전체 조회 API (GET)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId") || undefined;

    const project = await getOrCreateProjectForWorkspace(workspaceId);
    
    const tasks = await prisma.task.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(tasks);
  } catch (error: any) {
    console.error("GET Tasks Error:", error);
    return NextResponse.json(
      { error: "태스크 데이터를 불러오지 못했습니다.", details: error.message },
      { status: 500 }
    );
  }
}

// 2. 태스크 생성 및 Gemini AI 자동 판별 API (POST)
export async function POST(req: Request) {
  try {
    const { title, description, assignee, workspaceId } = await req.json();

    if (!title) {
      return NextResponse.json(
        { error: "태스크 제목은 필수 입력 항목입니다." },
        { status: 400 }
      );
    }

    const project = await getOrCreateProjectForWorkspace(workspaceId);
    const apiKey = process.env.GEMINI_API_KEY;

    let type = "기획";
    let difficulty = "중";
    let aiFeedback = "";

    // Gemini API가 사용 가능한 경우 판별 처리 (내부 예외처리 강화)
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel(
          {
            model: "gemini-2.5-flash",
          },
          { apiVersion: "v1" }
        );

        const prompt = `
당신은 전공자와 비전공자가 혼합된 AI 부트캠프 대학생 프로젝트의 협업 관리자입니다.
다음 태스크(할 일)의 제목과 상세 설명을 분석하여, 적절한 역할 분야, 기술적 난이도 및 팀 협업 가이드를 JSON 형식으로 반환해 주세요.

[태스크 정보]
- 제목: ${title}
- 상세 설명: ${description || "상세 내용 없음"}

[판별 기준]
1. type (분야): 다음 4개 중 반드시 하나를 선택해 주세요.
   - "기획" (문서 작성, 기획 조율, 발표 자료 등)
   - "데이터" (데이터 수집, 라벨링, 전처리 규칙 설정 등)
   - "모델" (모델 프롬프트 테스트, 파인튜닝, AI 추론 로직 등)
   - "개발" (웹 프론트/백엔드 코딩, UI/UX 스타일링, 소켓 연동 등)

2. difficulty (난이도): 다음 3개 중 반드시 하나를 선택해 주세요.
   - "하" (비전공자 단독으로도 엑셀이나 문서를 통해 즉시 수행할 수 있는 작업)
   - "중" (전공자의 약간의 서포트 또는 학습 가이드가 수반되면 협업 가능한 작업)
   - "상" (고도의 전공 코딩 지식이나 모델 튜닝 실무가 필요한 전공자 전용 작업)

3. aiFeedback (협업 가이드):
   - 해당 태스크가 왜 이 분야와 난이도로 지정되었는지 이유를 서술하세요.
   - 비전공자와 전공자 팀원들이 이 태스크를 가지고 어떻게 분배하고 소통해야 하는지 구체적이고 부드러운 한국어 문체로 조언해 주세요. (약 3~4문장)

[반환 형식]
반드시 다음 스키마를 따르는 JSON 데이터 하나만 반환해야 하며, 다른 서술 텍스트는 포함하지 마십시오.
{
  "type": "기획" | "데이터" | "모델" | "개발",
  "difficulty": "상" | "중" | "하",
  "aiFeedback": "구체적인 협업 가이드 조언"
}
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        try {
          let cleanText = responseText.trim();
          if (cleanText.startsWith("```json")) {
            cleanText = cleanText.substring(7);
          } else if (cleanText.startsWith("```")) {
            cleanText = cleanText.substring(3);
          }
          if (cleanText.endsWith("```")) {
            cleanText = cleanText.substring(0, cleanText.length - 3);
          }
          cleanText = cleanText.trim();

          const aiResponse = JSON.parse(cleanText);
          type = aiResponse.type || type;
          difficulty = aiResponse.difficulty || difficulty;
          aiFeedback = aiResponse.aiFeedback || "";
        } catch (parseErr) {
          console.error("AI Response JSON parsing failed:", parseErr);
          aiFeedback = `💡 AI 분석 파싱 실패 (원본 데이터: ${responseText.substring(0, 80)}...)`;
        }
      } catch (aiErr: any) {
        console.error("Gemini API call failed:", aiErr);
        aiFeedback = `💡 Gemini API 키 인증 실패 또는 사용 불가: API 키 형식(AIzaSy로 시작하는 키)을 확인해 주세요. (오류 메시지: ${aiErr.message || "Unknown"})`;
      }
    } else {
      aiFeedback = "💡 Gemini API 키가 설정되지 않아 기본 분류로 대체 등록되었습니다.";
    }

    let matchedUserId: string | null = null;
    if (assignee) {
      const userById = await prisma.user.findUnique({ where: { id: assignee } });
      if (userById) {
        matchedUserId = userById.id;
      } else {
        const userByName = await prisma.user.findFirst({ where: { name: assignee } });
        if (userByName) {
          matchedUserId = userByName.id;
        }
      }
    }

    // Neon DB에 태스크 저장 (AI API 에러 유무에 상관없이 반드시 정상 생성됨)
    const newTask = await prisma.task.create({
      data: {
        title,
        description: description || "",
        status: "To-Do",
        type,
        difficulty,
        assigneeId: matchedUserId,
        assigneeName: assignee || "담당자 미지정",
        githubPrUrl: aiFeedback || "협업 정보 없음",
        projectId: project.id,
      },
    });

    // Pusher 실시간 동기화
    try {
      if (process.env.PUSHER_APP_ID) {
        const { pusherServer } = await import("@/lib/pusher");
        await pusherServer.trigger(`workspace-${project.workspaceId}`, "task-created", newTask);
      }
    } catch (pusherErr) {
      console.error("Pusher task-created trigger failed:", pusherErr);
    }

    // 디스코드 실시간 알림 연동
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: project.workspaceId }
      });
      const webhookUrl = workspace?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;

      if (webhookUrl) {
        const { sendDiscordNotification } = await import("@/lib/discord");
        await sendDiscordNotification({
          title: "🚀 새로운 작업(Task)이 등록되었습니다!",
          description: `**제목**: ${newTask.title}\n**담당**: ${newTask.assigneeName || "미지정"}\n**분야**: ${newTask.type} | **난이도**: ${newTask.difficulty}`,
          color: 9390288,
          fields: [
            { name: "상세 내용", value: newTask.description || "상세 설명 없음" },
            { name: "AI 피드백 요약", value: (newTask.githubPrUrl && newTask.githubPrUrl.length > 200) ? `${newTask.githubPrUrl.substring(0, 200)}...` : (newTask.githubPrUrl || "정보 없음") }
          ]
        }, webhookUrl);
      }
    } catch (discordErr) {
      console.error("Discord task-created notification failed:", discordErr);
    }

    return NextResponse.json(newTask);
  } catch (error: any) {
    console.error("POST Create Task Error:", error);
    return NextResponse.json(
      { error: "태스크를 생성하지 못했습니다.", details: error.message },
      { status: 500 }
    );
  }
}
