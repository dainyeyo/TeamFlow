import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import crypto from "crypto";

// 6자리 난수 초대코드 생성기
function generateInviteCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const members = await prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      include: {
        workspace: {
          include: {
            projects: true,
          }
        }
      }
    });

    const workspaces = members.map(m => m.workspace);
    return NextResponse.json(workspaces);
  } catch (error: any) {
    console.error("GET Workspaces Error:", error);
    return NextResponse.json({ error: "워크스페이스 목록을 가져오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { action, name, inviteCode } = await req.json();

    if (action === "create") {
      if (!name) {
        return NextResponse.json({ error: "워크스페이스 이름은 필수입니다." }, { status: 400 });
      }

      let code = generateInviteCode();
      let isUnique = false;
      while (!isUnique) {
        const existing = await prisma.workspace.findUnique({ where: { inviteCode: code } });
        if (!existing) isUnique = true;
        else code = generateInviteCode();
      }

      const result = await prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
          data: {
            name,
            inviteCode: code,
          }
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: session.user.id,
            role: "Owner",
          }
        });

        const project = await tx.project.create({
          data: {
            name: "AI MVP 프로젝트",
            description: "팀에서 협업을 진행하는 AI 프로젝트 보드입니다.",
            workspaceId: workspace.id,
          }
        });

        return { workspace, project };
      });

      return NextResponse.json(result);
    } 
    
    if (action === "join") {
      if (!inviteCode) {
        return NextResponse.json({ error: "참여 코드가 누락되었습니다." }, { status: 400 });
      }

      const workspace = await prisma.workspace.findUnique({
        where: { inviteCode: inviteCode.trim().toUpperCase() }
      });

      if (!workspace) {
        return NextResponse.json({ error: "해당 참여 코드를 가진 팀을 찾을 수 없습니다." }, { status: 404 });
      }

      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: session.user.id,
          }
        }
      });

      if (existingMember) {
        return NextResponse.json({ error: "이미 이 팀에 참여 중입니다.", workspaceId: workspace.id }, { status: 400 });
      }

      await prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: session.user.id,
          role: "Member",
        }
      });

      return NextResponse.json({ success: true, workspaceId: workspace.id });
    }

    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  } catch (error: any) {
    console.error("POST Workspace Action Error:", error);
    return NextResponse.json({ error: error.message || "작업 도중 에러가 발생했습니다." }, { status: 500 });
  }
}
