"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Pusher from "pusher-js";
import styles from "./page.module.css";

// Neon DB Task 인터페이스 정의
interface Task {
  id: string;
  title: string;
  description: string;
  status: "To-Do" | "In Progress" | "Peer Review" | "Done";
  type: "기획" | "데이터" | "모델" | "개발";
  difficulty: "상" | "중" | "하";
  assigneeId: string | null;
  assigneeName: string | null;
  githubPrUrl: string | null;
  createdAt: string;
}

interface Comment {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    role: string;
    specialty: string;
  };
}

interface GlossaryTerm {
  term: string;
  definition: string;
}

function BoardContent() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceName, setWorkspaceName] = useState("로딩 중...");
  const [inviteCode, setInviteCode] = useState("");
  const [activeFilter, setActiveFilter] = useState<"전체" | "기획" | "데이터" | "모델" | "개발">("전체");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // 댓글 관련 상태
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [explainingCommentId, setExplainingCommentId] = useState<string | null>(null);
  const [glossaryData, setGlossaryData] = useState<{ hasGlossary: boolean; terms: GlossaryTerm[] } | null>(null);

  // 디스코드 개별 연동 관련 상태
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);

  // 프로젝트 브리핑 메모 관련 상태
  const [projectGoal, setProjectGoal] = useState("");
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  // 대규모 관리를 위한 다중 검색/필터 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("전체");
  const [difficultyFilter, setDifficultyFilter] = useState("전체");

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    if (!workspaceId && sessionStatus === "authenticated") {
      router.push("/");
    }
  }, [workspaceId, sessionStatus, router]);

  const fetchTasksAndWorkspace = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks?workspaceId=${workspaceId}`);
      if (!response.ok) throw new Error("데이터 조회 실패");
      const data = await response.json();
      setTasks(data);

      const wsResponse = await fetch("/api/workspaces");
      if (wsResponse.ok) {
        const workspaces = await wsResponse.json();
        const currentWs = workspaces.find((w: any) => w.id === workspaceId);
        if (currentWs) {
          setWorkspaceName(currentWs.name);
          setInviteCode(currentWs.inviteCode);
          setDiscordWebhookUrl(currentWs.discordWebhookUrl || "");
        } else {
          setWorkspaceName("알 수 없는 워크스페이스");
        }
      }

      // 프로젝트 브리핑 목표 데이터 패칭
      const pjResponse = await fetch(`/api/workspaces/${workspaceId}/project`);
      if (pjResponse.ok) {
        const pjData = await pjResponse.json();
        setProjectGoal(pjData.description || "");
      }
    } catch (err) {
      console.error(err);
      alert("워크스페이스의 작업을 가져오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === "authenticated" && workspaceId) {
      fetchTasksAndWorkspace();
      if (session?.user?.name) {
        setNewAssignee(session.user.name);
      }
    }
  }, [sessionStatus, workspaceId]);

  const fetchComments = async (taskId: string) => {
    setLoadingComments(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (err) {
      console.error("댓글 조회 실패:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (selectedTask) {
      fetchComments(selectedTask.id);
      setGlossaryData(null);
    } else {
      setComments([]);
    }
  }, [selectedTask]);

  useEffect(() => {
    if (!workspaceId) return;

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || "local_key";
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap3";

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
      forceTLS: true,
    });

    const channelName = `workspace-${workspaceId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind("task-created", (newTask: Task) => {
      setTasks((prev) => {
        if (prev.some((t) => t.id === newTask.id)) return prev;
        return [...prev, newTask];
      });
    });

    channel.bind("task-updated", (updatedTask: Task) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      );
      setSelectedTask((prev) => {
        if (prev?.id === updatedTask.id) return updatedTask;
        return prev;
      });
    });

    channel.bind("task-deleted", ({ taskId }: { taskId: string }) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSelectedTask((prev) => (prev?.id === taskId ? null : prev));
    });

    return () => {
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [workspaceId]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !workspaceId) return;

    setCreating(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          assignee: newAssignee || session?.user?.name || "담당자 미지정",
          workspaceId,
        }),
      });

      if (!response.ok) throw new Error("태스크 생성 실패");
      const newTask = await response.json();

      setTasks(prev => {
        if (prev.some(t => t.id === newTask.id)) return prev;
        return [...prev, newTask];
      });

      setNewTitle("");
      setNewDesc("");
      setNewAssignee(session?.user?.name || "");
    } catch (err) {
      console.error(err);
      alert("태스크 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const executeStatusUpdate = async (taskId: string, newStatus: Task["status"]) => {
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("DB 업데이트 실패");
    } catch (err) {
      console.error(err);
      fetchTasksAndWorkspace();
    }
  };

  const moveTask = (taskId: string, direction: "prev" | "next") => {
    const statusOrder: Task["status"][] = ["To-Do", "In Progress", "Peer Review", "Done"];
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    const currentIndex = statusOrder.indexOf(targetTask.status);
    let nextIndex = currentIndex;
    if (direction === "next" && currentIndex < statusOrder.length - 1) {
      nextIndex += 1;
    } else if (direction === "prev" && currentIndex > 0) {
      nextIndex -= 1;
    }

    executeStatusUpdate(taskId, statusOrder[nextIndex]);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: Task["status"]) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    const targetTask = tasks.find(t => t.id === taskId);
    if (targetTask && targetTask.status !== targetStatus) {
      executeStatusUpdate(taskId, targetStatus);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("이 태스크를 데이터베이스에서 정말로 삭제하시겠습니까?")) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("삭제 실패");
      
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
      alert("태스크 삭제 도중 오류가 발생했습니다.");
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !selectedTask) return;

    setSubmittingComment(true);
    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentInput }),
      });

      if (!response.ok) throw new Error("댓글 등록 실패");
      const newComment = await response.json();
      setComments(prev => [...prev, newComment]);
      setCommentInput("");
    } catch (err) {
      console.error(err);
      alert("댓글 등록에 실패했습니다.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("이 댓글을 정말 삭제하시겠습니까?") || !selectedTask) return;

    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}/comments?commentId=${commentId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("댓글 삭제 실패");
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err) {
      console.error(err);
      alert("댓글 삭제 실패했습니다.");
    }
  };

  const handleExplainGlossary = async (commentId: string, content: string) => {
    setExplainingCommentId(commentId);
    setGlossaryData(null);
    try {
      const response = await fetch(`/api/tasks/${selectedTask?.id}/comments/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });

      if (!response.ok) throw new Error("AI 번역 실패");
      const data = await response.json();
      setGlossaryData(data);
    } catch (err) {
      console.error(err);
      alert("AI 용어 해석 도중 오류가 발생했습니다.");
    } finally {
      setExplainingCommentId(null);
    }
  };

  const handleSaveDiscordWebhook = async () => {
    if (!workspaceId) return;
    setSavingWebhook(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ discordWebhookUrl }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "웹훅 주소 저장 실패");
      }

      alert("디스코드 웹훅 주소가 성공적으로 저장되었습니다!");
      setShowDiscordModal(false);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "디스코드 웹훅 설정 도중 오류가 발생했습니다.");
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleSaveProjectGoal = async () => {
    if (!workspaceId) return;
    setSavingGoal(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/project`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description: projectGoal }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "목표 저장 실패");
      }

      setIsEditingGoal(false);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "프로젝트 목표 설정 도중 오류가 발생했습니다.");
    } finally {
      setSavingGoal(false);
    }
  };

  // 보드 내의 고유 담당자 목록 추출
  const uniqueAssignees = Array.from(
    new Set(tasks.map(t => t.assigneeName || t.assigneeId).filter(Boolean))
  ) as string[];

  const filteredTasks = tasks.filter(task => {
    // 1. 역할군 필터
    const matchesType = activeFilter === "전체" || task.type === activeFilter;
    // 2. 담당자 필터
    const nameOrId = task.assigneeName || task.assigneeId || "미지정";
    const matchesAssignee = assigneeFilter === "전체" || nameOrId === assigneeFilter;
    // 3. 난이도 필터
    const matchesDifficulty = difficultyFilter === "전체" || task.difficulty === difficultyFilter;
    // 4. 검색 쿼리 필터 (제목 + 설명)
    const matchesQuery = 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (task.description || "").toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesAssignee && matchesDifficulty && matchesQuery;
  });

  const columns: { title: Task["status"]; color: string }[] = [
    { title: "To-Do", color: "var(--muted)" },
    { title: "In Progress", color: "var(--warning)" },
    { title: "Peer Review", color: "var(--primary)" },
    { title: "Done", color: "var(--success)" }
  ];

  if (sessionStatus === "loading" || loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
        <p>프로젝트 및 작업 보드를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className={styles.boardContainer}>
      <div className={styles.dbBanner}>
        <span>🟢 <strong>실시간 칸반: {workspaceName}</strong> (초대코드: <strong className={styles.codeText}>{inviteCode}</strong>)</span>
        <div className={styles.topActions}>
          <button
            onClick={() => setShowDiscordModal(true)}
            className={styles.backHome}
            style={{ marginRight: 12, cursor: "pointer", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)" }}
          >
            ⚙️ 디스코드 설정
          </button>
          <Link href={`/board/reports?workspaceId=${workspaceId}`} className={styles.backHome} style={{ marginRight: 12 }}>
            📋 AI 데일리 랩업 요약
          </Link>
          <Link href="/" className={styles.backHome}>팀 대시보드로</Link>
        </div>
      </div>

      <header className={styles.header} style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className={styles.logoInfo}>
            <span className="gradient-text styles_logo">{workspaceName}</span>
          </div>
          <div className={styles.filterBar} style={{ margin: 0 }}>
            {(["전체", "기획", "데이터", "모델", "개발"] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`${styles.filterBtn} ${activeFilter === filter ? styles.activeFilter : ""}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* 대규모 관리를 위한 서브 필터바 */}
        <div className={styles.subFilterBar} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid hsl(var(--border) / 0.5)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'hsl(var(--muted))' }}>🔍 태스크 검색</label>
            <input
              type="text"
              placeholder="제목 또는 설명 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'hsla(224, 25%, 12%, 0.6)',
                border: '1px solid hsl(var(--border))',
                padding: '6px 10px',
                borderRadius: '6px',
                color: 'hsl(var(--foreground))',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '150px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'hsl(var(--muted))' }}>👤 담당 팀원</label>
            <select
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
              style={{
                background: 'hsla(224, 25%, 12%, 0.6)',
                border: '1px solid hsl(var(--border))',
                padding: '6px 10px',
                borderRadius: '6px',
                color: 'hsl(var(--foreground))',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="전체">전체 담당자</option>
              <option value="미지정">미지정</option>
              {uniqueAssignees.map((name, i) => (
                <option key={i} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '120px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'hsl(var(--muted))' }}>⚡ 난이도</label>
            <select
              value={difficultyFilter}
              onChange={e => setDifficultyFilter(e.target.value)}
              style={{
                background: 'hsla(224, 25%, 12%, 0.6)',
                border: '1px solid hsl(var(--border))',
                padding: '6px 10px',
                borderRadius: '6px',
                color: 'hsl(var(--foreground))',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="전체">전체 난이도</option>
              <option value="상">상</option>
              <option value="중">중</option>
              <option value="하">하</option>
            </select>
          </div>

          {(searchQuery || assigneeFilter !== "전체" || difficultyFilter !== "전체" || activeFilter !== "전체") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setAssigneeFilter("전체");
                setDifficultyFilter("전체");
                setActiveFilter("전체");
              }}
              style={{
                marginTop: '16px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '6px 12px',
                borderRadius: '6px',
                color: 'hsl(var(--foreground))',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              필터 초기화
            </button>
          )}
        </div>
      </header>

      <div className={styles.boardLayout}>
        <div className={styles.kanbanColumns}>
          {columns.map(col => {
            const colTasks = filteredTasks.filter(t => t.status === col.title);
            // In Progress, Peer Review 컬럼은 동시 진행 작업 수(WIP Limit)를 최대 4개로 제한합니다.
            const isWipExceeded = (col.title === "In Progress" || col.title === "Peer Review") && colTasks.length > 4;
            return (
              <div
                key={col.title}
                className={`${styles.column} ${isWipExceeded ? styles.wipExceeded : ""}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.title)}
              >
                <div className={styles.columnHeader}>
                  <div className={styles.columnTitle}>
                    <span className={styles.statusDot} style={{ backgroundColor: `hsl(${col.color})` }} />
                    <h4>
                      {col.title}
                      {isWipExceeded && <span style={{ fontSize: '10px', color: 'hsl(var(--destructive))', marginLeft: '6px', fontWeight: 'bold' }}>⚠️ WIP 초과</span>}
                    </h4>
                  </div>
                  <span className={styles.taskCount}>{colTasks.length}</span>
                </div>
                <div className={styles.taskContainer}>
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      className={`${styles.taskCard} glass-card`}
                      onClick={() => setSelectedTask(task)}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      style={{ cursor: "grab" }}
                    >
                      <div className={styles.cardHeader}>
                        <span className={`${styles.typeBadge} ${styles[task.type]}`}>
                          {task.type}
                        </span>
                        <span className={styles.diffBadge}>난이도: {task.difficulty}</span>
                      </div>
                      <h4 className={styles.taskTitle}>{task.title}</h4>
                      <p className={styles.assigneeText}>👤 {task.assigneeName || task.assigneeId || "담당자 미지정"}</p>

                      <div className={styles.cardControls} onClick={e => e.stopPropagation()}>
                        <button
                          disabled={col.title === "To-Do"}
                          onClick={() => moveTask(task.id, "prev")}
                          className={styles.moveBtn}
                        >
                          ◀
                        </button>
                        <button
                          disabled={col.title === "Done"}
                          onClick={() => moveTask(task.id, "next")}
                          className={styles.moveBtn}
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className={styles.emptyColumn}>드래그하여 작업을 이동하세요.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className={`${styles.sidebar} glass-card`}>
          {/* 📌 프로젝트 목표 및 진행 브리핑 메모장 */}
          <div style={{ marginBottom: '24px', borderBottom: '1px solid hsl(var(--border) / 0.5)', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'hsl(var(--accent))', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                📌 프로젝트 목표 & 진행 브리핑
              </h3>
              {!isEditingGoal && (
                <button
                  onClick={() => setIsEditingGoal(true)}
                  style={{ background: 'none', border: 'none', color: 'hsl(var(--muted))', cursor: 'pointer', fontSize: '13px' }}
                  title="브리핑 수정"
                >
                  ✏️ 수정
                </button>
              )}
            </div>

            {isEditingGoal ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  value={projectGoal}
                  onChange={e => setProjectGoal(e.target.value)}
                  placeholder="프로젝트 주제, 주요 일정, 마일스톤 등을 자유롭게 적어 공유하세요."
                  rows={4}
                  style={{
                    width: '100%',
                    background: 'hsla(224, 25%, 12%, 0.6)',
                    border: '1px solid hsl(var(--border))',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setIsEditingGoal(false)}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveProjectGoal}
                    className="btn-primary"
                    disabled={savingGoal}
                    style={{ padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    {savingGoal ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'hsla(224, 25%, 12%, 0.4)',
                border: '1px solid hsl(var(--border) / 0.3)',
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'hsl(var(--muted-foreground))',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6'
              }}>
                {projectGoal.trim() || "💡 등록된 프로젝트의 큰 목표나 일정이 없습니다. 우측 상단 수정 단추를 눌러 첫 브리핑을 작성해 보세요!"}
              </div>
            )}
          </div>

          <h3>➕ AI 자동 태깅 태스크 추가</h3>
          <p className={styles.sidebarDesc}>하고 싶은 일의 내용만 적어보세요. AI가 기술적 난이도와 적정 담당 분야를 자동 분석하여 보드에 등록해 줍니다.</p>
          <form onSubmit={handleAddTask} className={styles.taskForm}>
            <div className={styles.formGroup}>
              <label>태스크 제목</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="예: 데이터 100건 수집"
                required
                disabled={creating}
              />
            </div>
            <div className={styles.formGroup}>
              <label>담당 팀원</label>
              <input
                type="text"
                value={newAssignee}
                onChange={e => setNewAssignee(e.target.value)}
                placeholder="팀원 이름"
                disabled={creating}
              />
            </div>
            <div className={styles.formGroup}>
              <label>수행할 구체적인 내용</label>
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="기술적 힌트가 들어갈 수 있게 구체적으로 적어주면 AI가 난이도를 더 정밀하게 분류해 줍니다."
                rows={4}
                disabled={creating}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? "Gemini가 분석 등록 중..." : "AI 자동 분석 및 등록"}
            </button>
          </form>
        </div>
      </div>

      {selectedTask && (
        <div className={styles.modalOverlay} onClick={() => setSelectedTask(null)}>
          <div className={`${styles.modalContent} glass-card`} onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className={styles.modalHeader}>
              <span className={`${styles.typeBadge} ${styles[selectedTask.type]}`}>
                {selectedTask.type}
              </span>
              <button className={styles.closeBtn} onClick={() => setSelectedTask(null)}>
                &times;
              </button>
            </div>
            <h2>{selectedTask.title}</h2>
            <div className={styles.modalMeta}>
              <p><strong>담당자:</strong> {selectedTask.assigneeName || selectedTask.assigneeId || "담당자 미지정"}</p>
              <p><strong>난이도:</strong> {selectedTask.difficulty}</p>
              <p><strong>상태:</strong> {selectedTask.status}</p>
            </div>
            <div className={styles.modalBody}>
              <h4>상세 작업 설명</h4>
              <p>{selectedTask.description || "상세 작업 설명이 작성되지 않았습니다."}</p>
            </div>

            <div className={styles.aiSection}>
              <h4>🤖 등록 시점 AI 협업 가이드 조언</h4>
              <div className={styles.aiFeedbackBox}>
                <p>{selectedTask.githubPrUrl || "태깅 완료 정보가 불안정합니다."}</p>
              </div>
            </div>

            <div style={{ marginTop: '24px', borderTop: '1px solid hsl(var(--border) / 0.5)', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>💬 팀 소통 및 피드백 댓글 ({comments.length})</h3>
              
              {glossaryData && (
                <div className="glass-card" style={{ padding: '16px', marginBottom: '16px', border: '1px solid hsl(var(--accent) / 0.3)', background: 'hsla(190, 95%, 48%, 0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ color: 'hsl(var(--accent))', fontSize: '13px' }}>🤖 AI 용어 사전 번역 결과</strong>
                    <button onClick={() => setGlossaryData(null)} style={{ background: 'none', border: 'none', color: 'hsl(var(--muted))', cursor: 'pointer', fontSize: '14px' }}>&times;</button>
                  </div>
                  {!glossaryData.hasGlossary ? (
                    <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>텍스트에서 설명할 특별한 전문 기술 용어가 감지되지 않았습니다. 일상적인 문장입니다.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {glossaryData.terms.map((term, i) => (
                        <div key={i} style={{ fontSize: '13px' }}>
                          <span style={{ color: 'hsl(var(--foreground))', fontWeight: '700', borderBottom: '2px solid hsl(var(--primary) / 0.4)', paddingBottom: '1px' }}>{term.term}</span>: <span style={{ color: 'hsl(var(--muted-foreground))' }}>{term.definition}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                {loadingComments ? (
                  <p style={{ fontSize: '13px', color: 'hsl(var(--muted))' }}>댓글 불러오는 중...</p>
                ) : comments.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'hsl(var(--muted))', textAlign: 'center', padding: '16px 0' }}>작성된 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="glass-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '13px' }}>{comment.author.name}</strong>
                          <span style={{ fontSize: '10px', background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', padding: '2px 6px', borderRadius: '4px', border: '1px solid hsl(var(--primary) / 0.2)' }}>
                            {comment.author.role === "Mentor" ? "멘토" : comment.author.specialty}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => handleExplainGlossary(comment.id, comment.content)}
                            disabled={explainingCommentId !== null}
                            style={{ background: 'none', border: 'none', color: 'hsl(var(--accent))', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                          >
                            {explainingCommentId === comment.id ? "해석 중..." : "🤖 용어 설명"}
                          </button>
                          {(session?.user?.id === comment.authorId || session?.user?.role === "Team Leader") && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              style={{ background: 'none', border: 'none', color: 'hsl(var(--destructive))', cursor: 'pointer', fontSize: '11px' }}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: '13px', color: 'hsl(var(--foreground))', whiteSpace: 'pre-wrap' }}>{comment.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder={sessionStatus === "authenticated" ? "개발 용어나 질문을 편하게 댓글로 적어보세요..." : "로그인 후 작성 가능합니다."}
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  disabled={submittingComment || sessionStatus !== "authenticated"}
                  style={{
                    flex: 1,
                    background: 'hsla(224, 25%, 12%, 0.6)',
                    border: '1px solid hsl(var(--border))',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                <button type="submit" className="btn-primary" disabled={submittingComment || !commentInput.trim() || sessionStatus !== "authenticated"} style={{ padding: '8px 16px', fontSize: '13px' }}>
                  등록
                </button>
              </form>
            </div>

            <div className={styles.actionBar}>
              <button
                onClick={() => handleDeleteTask(selectedTask.id)}
                className={styles.deleteBtn}
              >
                🗑️ 이 태스크 영구 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiscordModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDiscordModal(false)}>
          <div className={`${styles.modalContent} glass-card`} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>⚙️ 디스코드 알림 개별 연동</h3>
              <button className={styles.closeBtn} onClick={() => setShowDiscordModal(false)}>
                &times;
              </button>
            </div>
            <div className={styles.modalBody} style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '16px', lineHeight: '1.5' }}>
                이 워크스페이스(팀) 전용 디스코드 웹훅 URL을 등록해 보세요.<br />
                태스크 생성, Done 완료, 일일 랩업 생성 시 설정된 채널로 즉시 알림이 발송됩니다.
              </p>
              <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>디스코드 Webhook URL</label>
                <input
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={discordWebhookUrl}
                  onChange={e => setDiscordWebhookUrl(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'hsla(224, 25%, 12%, 0.6)',
                    border: '1px solid hsl(var(--border))',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>
              <p style={{ fontSize: '11px', color: 'hsl(var(--muted))', marginTop: '8px', lineHeight: '1.4' }}>
                💡 팁: 채널 설정 &gt; 연동 &gt; 웹후크에서 웹훅 URL을 생성하여 복사해 붙여넣으세요. 입력란을 완전히 지우고 저장하면 개별 채널 연동이 해제됩니다.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setShowDiscordModal(false)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>
                취소
              </button>
              <button onClick={handleSaveDiscordWebhook} className="btn-primary" disabled={savingWebhook} style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>
                {savingWebhook ? "저장 중..." : "설정 저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
        <p>프로젝트 보드 준비 중...</p>
      </div>
    }>
      <BoardContent />
    </Suspense>
  );
}
