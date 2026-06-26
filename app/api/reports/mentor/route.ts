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

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        projects: {
          include: {
            tasks: true,
          }
        }
      }
    });

    if (!workspace) {
      return NextResponse.json({ error: "워크스페이스를 찾을 수 없습니다." }, { status: 404 });
    }

    const project = workspace.projects[0];
    if (!project) {
      return NextResponse.json({
        stats: { total: 0, done: 0, planning: 0, data: 0, model: 0, dev: 0, todo: 0, inProgress: 0, peerReview: 0 },
        aiReport: "등록된 프로젝트가 없어 분석을 수행할 수 없습니다.",
        healthScore: 100,
        suggestions: [],
        mentorComments: [],
      });
    }

    const tasks = project.tasks;
    const total = tasks.length;
    const done = tasks.filter(t => t.status === "Done").length;
    const todo = tasks.filter(t => t.status === "To-Do").length;
    const inProgress = tasks.filter(t => t.status === "In Progress").length;
    const peerReview = tasks.filter(t => t.status === "Peer Review").length;

    const planning = tasks.filter(t => t.type === "기획").length;
    const data = tasks.filter(t => t.type === "데이터").length;
    const modelTasks = tasks.filter(t => t.type === "모델").length;
    const devTasks = tasks.filter(t => t.type === "개발").length;

    const mentorComments = await prisma.comment.findMany({
      where: {
        task: {
          projectId: project.id
        },
        author: {
          role: "Mentor"
        }
      },
      include: {
        author: {
          select: { name: true, specialty: true }
        },
        task: {
          select: { title: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const apiKey = process.env.GEMINI_API_KEY;
    let healthScore = 80;
    let aiReport = "💡 **AI 협업 진단서 분석 제한**\n\nGemini API 키가 설정되지 않았거나 호출에 실패하여 기본 분석 결과로 대체되었습니다.";
    let suggestions: string[] = [
      "개발 및 모델링 태스크 완료율을 체크하세요.",
      "기획자 팀원들의 리소스 부족 여부를 조율하세요.",
      "총괄 매니저 피드백 타임라인을 참고하여 주기적으로 지도를 진행해 주세요."
    ];

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const aiModel = genAI.getGenerativeModel(
          {
            model: "gemini-2.5-flash",
          },
          { apiVersion: "v1" }
        );

        const prompt = `
당신은 IT 실무 부서의 총괄 매니저(Project Director / General Manager)이자 프로젝트 리스크 매니지먼트 전문가입니다.
현재 진행 중인 프로젝트의 태스크 분포 데이터를 바탕으로, 이 팀의 협업 상황을 진단하고 조언을 생성해 주세요.

[태스크 통계 데이터]
- 총 태스크 개수: ${total}개 (완료: ${done}개, 진행 중: ${inProgress}개, 검토 중: ${peerReview}개, 대기 중: ${todo}개)
- 역할군별 태스크 개수:
  - 비기술 영역 (기획 / 디자인 / 도메인 기획): ${planning}개
  - 데이터 파트 (데이터 분석 및 수집): ${data}개
  - 기술 영역 (AI 모델링 및 엔지니어링): ${modelTasks}개
  - 기술 영역 (웹 백엔드/프론트엔드 시스템 개발): ${devTasks}개

[진단 기준]
1. 기술 개발(개발/모델링) 파트에 비해 비기술(기획/데이터) 영역의 태스크 분배 불균형이 있는지 확인하고 이를 협업 리스크로 진단해 주십시오.
2. 진행 상태 중 'Peer Review' 상태나 'In Progress'에 카드가 밀려 정체되어 있다면 병목 현상 리스크로 판단합니다.
3. healthScore (협업 건강도 점수): 위 리스크 유무에 따라 0점~100점 사이로 점수를 매겨 주십시오.
4. analysis (진단 요약): 현재 팀의 협업 상태에 대한 객체적인 진단을 3~4문장으로 서술해 주십시오. (부드러운 한국어 문체)
5. suggestions (PM과 팀을 위한 총괄 매니징 피드백 가이드): 이 팀에 피드백할 때 어떤 방향으로 가이드해야 기술-비기술 직군 간 소통이 원활해지고 생산성 높은 마감이 가능할지 조언 사항을 3~4가지 제안하십시오.

반드시 다음 JSON 형식을 엄수해야 하며, 다른 서술은 결과에 포함하지 마십시오.
{
  "healthScore": 80,
  "analysis": "진단 결과 내용",
  "suggestions": [
    "조언 1",
    "조언 2",
    "조언 3"
  ]
}
`;

        const result = await aiModel.generateContent(prompt);
        const responseText = result.response.text();
        
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

        const parsedData = JSON.parse(cleanText);

        healthScore = parsedData.healthScore || healthScore;
        aiReport = parsedData.analysis || aiReport;
        suggestions = parsedData.suggestions || suggestions;
      } catch (aiErr: any) {
        console.error("Gemini call in Mentor API failed:", aiErr);
        aiReport = `💡 **AI 협업 진단서 분석 실패** (Gemini API 인증/통신 오류)\n\n환경변수(GEMINI_API_KEY) 설정값이나 네트워크 상태를 확인해 주세요. (오류 내용: ${aiErr.message || "Unknown"})`;
      }
    }

    return NextResponse.json({
      stats: { total, done, todo, inProgress, peerReview, planning, data, model: modelTasks, dev: devTasks },
      healthScore,
      aiReport,
      suggestions,
      mentorComments,
    });

  } catch (error: any) {
    console.error("Mentor Report Error:", error);
    return NextResponse.json({ error: "멘토 리포트 분석에 실패했습니다.", details: error.message }, { status: 500 });
  }
}
