import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const isPrMerged =
      payload.action === "closed" &&
      payload.pull_request &&
      payload.pull_request.merged === true;

    if (!isPrMerged) {
      return NextResponse.json({ message: "PR 머지 이벤트가 아니므로 무시합니다." });
    }

    const prTitle = payload.pull_request.title || "";
    const prBody = payload.pull_request.body || "";
    const prUrl = payload.pull_request.html_url || "";

    const regex = /#([a-zA-Z0-9_-]{20,})/g;
    const textToSearch = `${prTitle} ${prBody}`;
    const matches = [...textToSearch.matchAll(regex)];

    if (matches.length === 0) {
      return NextResponse.json({ message: "연동된 태스크 ID(#cuid 등)를 찾을 수 없습니다." });
    }

    const updatedTasks = [];

    for (const match of matches) {
      const taskId = match[1];

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { project: true }
      });

      if (task) {
        const updated = await prisma.task.update({
          where: { id: taskId },
          data: {
            status: "Done",
            githubPrUrl: `🔗 [GitHub PR #${payload.pull_request.number}](${prUrl})가 머지되어 완료되었습니다.`,
          },
          include: { project: true }
        });

        try {
          if (process.env.PUSHER_APP_ID) {
            const { pusherServer } = await import("@/lib/pusher");
            await pusherServer.trigger(`workspace-${updated.project.workspaceId}`, "task-updated", updated);
          }
        } catch (pusherErr) {
          console.error("Pusher trigger from Webhook failed:", pusherErr);
        }

        updatedTasks.push(taskId);
      }
    }

    return NextResponse.json({
      success: true,
      message: `성공적으로 ${updatedTasks.length}개의 태스크를 완료 처리했습니다.`,
      updatedTasks,
    });
  } catch (error: any) {
    console.error("GitHub Webhook Error:", error);
    return NextResponse.json(
      { error: "웹훅 처리 실패", details: error.message },
      { status: 500 }
    );
  }
}
