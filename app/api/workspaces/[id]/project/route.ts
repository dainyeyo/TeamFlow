import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// GET: 워크스페이스의 프로젝트 조회
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: workspaceId } = await params;
  try {
    let project = await prisma.project.findFirst({
      where: { workspaceId },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          name: "AI MVP 프로젝트",
          description: "여기에 프로젝트의 최종 목표와 팀원 공유를 위한 진행 상황을 입력해 보세요.",
          workspaceId,
        },
      });
    }

    return NextResponse.json(project);
  } catch (error: any) {
    console.error("GET Project Error:", error);
    return NextResponse.json({ error: "프로젝트 정보를 조회하지 못했습니다." }, { status: 500 });
  }
}

// PATCH: 워크스페이스의 프로젝트 정보 수정
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
    // 해당 워크스페이스 멤버 여부 체크
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "해당 워크스페이스에 대한 수정 권한이 없습니다." }, { status: 403 });
    }

    const { name, description } = await req.json();

    let project = await prisma.project.findFirst({
      where: { workspaceId },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          name: name || "AI MVP 프로젝트",
          description: description || "",
          workspaceId,
        },
      });
    } else {
      project = await prisma.project.update({
        where: { id: project.id },
        data: {
          name: name !== undefined ? name : project.name,
          description: description !== undefined ? description : project.description,
        },
      });
    }

    return NextResponse.json(project);
  } catch (error: any) {
    console.error("PATCH Project Error:", error);
    return NextResponse.json({ error: "프로젝트 정보 수정에 실패했습니다.", details: error.message }, { status: 500 });
  }
}
