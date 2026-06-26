import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: workspaceId } = await params;
  try {
    // 1. 해당 워크스페이스의 멤버인지 확인
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "해당 워크스페이스에 대한 수정 권한이 없습니다." },
        { status: 403 }
      );
    }

    const { discordWebhookUrl } = await req.json();

    // 2. 디스코드 웹훅 주소 유효성 검사 (입력값이 있을 경우)
    if (discordWebhookUrl && discordWebhookUrl.trim() !== "") {
      const urlRegex = /^https:\/\/discord(app)?\.com\/api\/webhooks\//;
      if (!urlRegex.test(discordWebhookUrl.trim())) {
        return NextResponse.json(
          { error: "올바른 디스코드 웹훅 URL 형식이 아닙니다." },
          { status: 400 }
        );
      }
    }

    // 3. 워크스페이스 업데이트
    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        discordWebhookUrl: discordWebhookUrl ? discordWebhookUrl.trim() : null,
      },
    });

    return NextResponse.json(updatedWorkspace);
  } catch (error: any) {
    console.error("PATCH Workspace Error:", error);
    return NextResponse.json(
      { error: "워크스페이스 설정 수정에 실패했습니다.", details: error.message },
      { status: 500 }
    );
  }
}
