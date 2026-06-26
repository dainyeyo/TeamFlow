import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { title, description } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "구동 환경에 GEMINI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    // Gemini API 초기화 (1.5 Flash 모델 사용)
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
- 상세 설명: ${description}

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
   - 해당 태스크가 왜 이 분야와 난이도로 지정되었는지 설명하고, 비전공자와 전공자가 역할을 어떻게 나누어 일할지 조언해 주세요.
   - 단, 가독성을 위해 반드시 줄바꿈(\n)을 활용하여 다음 3가지 항목 형식으로만 보기 좋게 나누어 작성해 주세요. (이외의 인사말이나 사족은 생략)
   💡 지정 이유: [이유를 1문장으로 요약]
   🌱 비전공자 가이드: [비전공 팀원을 위한 구체적 가이드 1~2문장]
   💻 전공자 가이드: [전공 팀원을 위한 구체적 가이드 1~2문장]

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

    const aiData = JSON.parse(cleanText);

    return NextResponse.json(aiData);
  } catch (error: any) {
    console.error("Gemini AI API Error:", error);
    return NextResponse.json(
      { error: "AI 분석 도중 에러가 발생했습니다.", details: error.message },
      { status: 500 }
    );
  }
}
