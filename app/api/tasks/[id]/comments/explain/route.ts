import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(
  req: Request
) {
  try {
    const { text } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "해석할 댓글 텍스트가 누락되었습니다." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        hasGlossary: false,
        terms: [],
        warning: "Gemini API 키가 설정되지 않아 AI 번역이 비활성화되었습니다."
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel(
      {
        model: "gemini-2.5-flash",
      },
      { apiVersion: "v1" }
    );

    const prompt = `
당신은 비기술직군(기획자, 디자이너, 전공 분야 외 입문자)을 돕는 친절한 AI 기술 어시스턴트입니다.
다음 텍스트(팀원들이 남긴 개발 댓글)를 분석하여, 비기술직군 팀원이 보기에 생소하거나 어려울 수 있는 IT 전문 용어, 개발 은어, AI/데이터 용어, 개발 프로세스 약어(예: Docker, Webhook, PR, Merge, API, 파인튜닝, Epoch, Lambda, CI/CD 등)를 추출하고 이를 초등학생도 직관적으로 이해할 수 있는 쉬운 한국어로 해설해 주세요.

[분석할 댓글 텍스트]
"${text}"

[출력 지침]
1. 텍스트 내에 설명할 필요가 있는 전문 용어가 존재한다면 hasGlossary를 true로 설정하고, 추출한 term과 그에 대한 쉬운 해설 definition을 배열에 담으십시오.
2. 해설은 핵심만 명확하게 2~3문장 이내로 작성해 주세요.
3. 텍스트에 IT 전문 용어 및 약어가 없거나 모두 일상적인 대화라면, hasGlossary를 false로 설정하고 terms 배열을 빈 값으로 하십시오.
4. 반드시 다음 JSON 스키마를 만족하는 하나의 JSON 데이터만 반환해야 하며 다른 안내 텍스트는 응답에 포함하지 마십시오.

{
  "hasGlossary": boolean,
  "terms": [
    {
      "term": "용어 이름",
      "definition": "쉬운 해설 텍스트"
    }
  ]
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

    const explanationData = JSON.parse(cleanText);

    return NextResponse.json(explanationData);
  } catch (error: any) {
    console.error("Glossary Explainer Error:", error);
    return NextResponse.json(
      { error: "용어를 해석하지 못했습니다.", details: error.message },
      { status: 500 }
    );
  }
}
