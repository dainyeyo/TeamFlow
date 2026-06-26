import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// 1. 태스크 상태 업데이트 API (PATCH)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15+ 규격에 맞춰 params를 비동기식(Promise)으로 파싱
    const { id } = await params;
    const { status, title, description, type, difficulty, assigneeName, assigneeId } = await req.json();

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (assigneeName !== undefined) updateData.assigneeName = assigneeName;
    
    if (assigneeId !== undefined) {
      updateData.assigneeId = assigneeId;
    } else if (assigneeName !== undefined) {
      if (assigneeName === "담당자 미지정" || assigneeName === "") {
        updateData.assigneeId = null;
      } else {
        const userByName = await prisma.user.findFirst({ where: { name: assigneeName } });
        if (userByName) {
          updateData.assigneeId = userByName.id;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "변경할 데이터가 누락되었습니다." },
        { status: 400 }
      );
    }

    // Neon DB에서 태스크 갱신
    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        project: true,
      },
    });

    // Pusher 실시간 동기화
    try {
      if (process.env.PUSHER_APP_ID) {
        const { pusherServer } = await import("@/lib/pusher");
        await pusherServer.trigger(`workspace-${updatedTask.project.workspaceId}`, "task-updated", updatedTask);
      }
    } catch (pusherErr) {
      console.error("Pusher task-updated trigger failed:", pusherErr);
    }

    // 디스코드 실시간 알림 연동 (Done 상태 완료 시)
    try {
      if (status === "Done") {
        const workspace = await prisma.workspace.findUnique({
          where: { id: updatedTask.project.workspaceId }
        });
        const webhookUrl = workspace?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;

        if (webhookUrl) {
          const { sendDiscordNotification } = await import("@/lib/discord");
          await sendDiscordNotification({
            title: "🎉 작업(Task)이 완료되었습니다!",
            description: `**제목**: ${updatedTask.title}\n**담당**: ${updatedTask.assigneeName || "미지정"}\n**분야**: ${updatedTask.type} | **난이도**: ${updatedTask.difficulty}`,
            color: 3066993, // 녹색 (Success Green)
            fields: [
              { name: "상세 설명", value: updatedTask.description || "설명 없음" }
            ]
          }, webhookUrl);
        }
      }
    } catch (discordErr) {
      console.error("Discord task-completed notification failed:", discordErr);
    }

    return NextResponse.json(updatedTask);
  } catch (error: any) {
    console.error("PATCH Task Error:", error);
    return NextResponse.json(
      { error: "태스크 상태를 갱신하지 못했습니다.", details: error.message },
      { status: 500 }
    );
  }
}

// 2. 태스크 삭제 API (DELETE)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15+ 규격에 맞춰 params를 비동기식(Promise)으로 파싱
    const { id } = await params;

    // 삭제할 태스크 정보 미리 조회
    const taskToDelete = await prisma.task.findUnique({
      where: { id },
      include: { project: true }
    });

    if (!taskToDelete) {
      return NextResponse.json({ error: "태스크를 찾을 수 없습니다." }, { status: 404 });
    }

    // Neon DB에서 해당 태스크 영구 제거
    await prisma.task.delete({
      where: { id },
    });

    // Pusher 실시간 동기화
    try {
      if (process.env.PUSHER_APP_ID) {
        const { pusherServer } = await import("@/lib/pusher");
        await pusherServer.trigger(`workspace-${taskToDelete.project.workspaceId}`, "task-deleted", { taskId: id });
      }
    } catch (pusherErr) {
      console.error("Pusher task-deleted trigger failed:", pusherErr);
    }

    return NextResponse.json({ success: true, message: "태스크가 정상적으로 삭제되었습니다." });
  } catch (error: any) {
    console.error("DELETE Task Error:", error);
    return NextResponse.json(
      { error: "태스크를 삭제하지 못했습니다.", details: error.message },
      { status: 500 }
    );
  }
}
