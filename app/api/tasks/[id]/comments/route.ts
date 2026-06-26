import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const comments = await prisma.comment.findMany({
      where: { taskId: id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            specialty: true,
          }
        }
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(comments);
  } catch (error: any) {
    console.error("GET Comments Error:", error);
    return NextResponse.json(
      { error: "댓글을 가져오지 못했습니다.", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { content } = await req.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "댓글 내용을 입력해주세요." }, { status: 400 });
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        taskId: id,
        authorId: session.user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            specialty: true,
          }
        }
      }
    });

    return NextResponse.json(comment);
  } catch (error: any) {
    console.error("POST Comment Error:", error);
    return NextResponse.json(
      { error: "댓글을 등록하지 못했습니다.", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json({ error: "삭제할 댓글 ID가 필요합니다." }, { status: 400 });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json({ error: "존재하지 않는 댓글입니다." }, { status: 404 });
    }

    if (comment.authorId !== session.user.id && session.user.role !== "Team Leader") {
      return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ success: true, message: "댓글이 삭제되었습니다." });
  } catch (error: any) {
    console.error("DELETE Comment Error:", error);
    return NextResponse.json(
      { error: "댓글을 삭제하지 못했습니다.", details: error.message },
      { status: 500 }
    );
  }
}
