"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

// 더미 태스크 정의 인터페이스
interface DummyTask {
  id: string;
  title: string;
  description: string;
  status: "To-Do" | "In Progress" | "Peer Review" | "Done";
  type: "기획" | "데이터" | "모델" | "개발";
  difficulty: "상" | "중" | "하";
  assignee: string;
  aiFeedback?: string;
}

const INITIAL_TASKS: DummyTask[] = [
  {
    id: "task-1",
    title: "AI 프로젝트 요구사항 정의서(PRD) 초안 작성",
    description: "전공자와 비전공자 역할 및 서비스 MVP의 4대 핵심 기능(칸반, 깃허브 연동, AI 분류, 요약) 정의.",
    status: "Done",
    type: "기획",
    difficulty: "하",
    assignee: "이민우 (기획/PM)",
    aiFeedback: "해당 태스크는 문서화 및 커뮤니케이션 중심 작업으로 비전공자도 주도적으로 진행하기 적합합니다."
  },
  {
    id: "task-2",
    title: "Next.js 14+ 기초 뼈대 구축 및 네온 테마 스타일링",
    description: "Vanilla CSS 변수를 활용한 HSL 모던 다크 테마 시스템 정의 및 globals.css 셋업.",
    status: "In Progress",
    type: "개발",
    difficulty: "중",
    assignee: "김진성 (웹 개발)",
    aiFeedback: "Next.js 라우팅 및 CSS 모듈 설계 작업입니다. 웹 개발 지식이 필요하므로 전공자 배치를 권장합니다."
  },
  {
    id: "task-3",
    title: "AI 모델 피드백 API 연동 & 프롬프트 테스트",
    description: "Gemini API 또는 OpenRouter를 연동하여 태스크 상세 설명 기반 분석 모듈 프로토타이핑.",
    status: "Peer Review",
    type: "모델",
    difficulty: "상",
    assignee: "박아름 (AI 연구원)",
    aiFeedback: "LLM API 호출 및 응답 파싱 코드가 포함됩니다. 백엔드 및 모델 전공자 주도의 페어 프로그래밍이 효과적입니다."
  },
  {
    id: "task-4",
    title: "AI 학습을 위한 한국어 구어체 데이터 500건 수집 및 정제",
    description: "부트캠프 타겟 데이터 소스 수집 및 간단한 엑셀 라벨링 작업 수행.",
    status: "To-Do",
    type: "데이터",
    difficulty: "하",
    assignee: "최수현 (기획/데이터)"
  },
  {
    id: "task-5",
    title: "Pusher 소켓을 활용한 실시간 칸반 상태 동기화 모듈 개발",
    description: "동일 워크스페이스 내 다수 멤버의 카드 이동 이벤트를 실시간으로 브로드캐스팅하는 클라이언트 리스너.",
    status: "To-Do",
    type: "개발",
    difficulty: "상",
    assignee: "김진성 (웹 개발)"
  }
];

export default function DemoPage() {
  const [tasks, setTasks] = useState<DummyTask[]>(INITIAL_TASKS);
  const [activeFilter, setActiveFilter] = useState<"전체" | "기획" | "데이터" | "모델" | "개발">("전체");
  const [selectedTask, setSelectedTask] = useState<DummyTask | null>(null);
  
  // 신규 태스크 생성 폼 상태
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"기획" | "데이터" | "모델" | "개발">("기획");
  const [newDifficulty, setNewDifficulty] = useState<"상" | "중" | "하">("중");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // AI 분석 시뮬레이션 상태
  const [aiLoading, setAiLoading] = useState(false);

  // 카드 상태 이동 핸들러
  const moveTask = (taskId: string, direction: "prev" | "next") => {
    const statusOrder: DummyTask["status"][] = ["To-Do", "In Progress", "Peer Review", "Done"];
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id !== taskId) return task;
        const currentIndex = statusOrder.indexOf(task.status);
        let nextIndex = currentIndex;
        if (direction === "next" && currentIndex < statusOrder.length - 1) {
          nextIndex += 1;
        } else if (direction === "prev" && currentIndex > 0) {
          nextIndex -= 1;
        }
        return { ...task, status: statusOrder[nextIndex] };
      })
    );
  };

  // 태스크 추가 핸들러
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: DummyTask = {
      id: `task-${Date.now()}`,
      title: newTitle,
      description: newDesc || "상세 설명이 없습니다.",
      status: "To-Do",
      type: newType,
      difficulty: newDifficulty,
      assignee: newAssignee || "담당자 미지정"
    };

    setTasks([...tasks, newTask]);
    setNewTitle("");
    setNewDesc("");
    setNewAssignee("");
  };

  // AI 가이드 API 연동 실행
  const runAiAnalysis = async (task: DummyTask) => {
    setAiLoading(true);
    try {
      const response = await fetch("/api/tasks/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: task.title,
          description: task.description,
        }),
      });

      if (!response.ok) {
        throw new Error("AI 분석 API 요청 실패");
      }

      const data = await response.json();
      
      const feedback = `💡 AI 분석 완료 (추천 분야: ${data.type} | 권장 난이도: ${data.difficulty})\n\n${data.aiFeedback}`;

      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === task.id
            ? { ...t, type: data.type, difficulty: data.difficulty, aiFeedback: feedback }
            : t
        )
      );
      
      setSelectedTask(prev =>
        prev
          ? { ...prev, type: data.type, difficulty: data.difficulty, aiFeedback: feedback }
          : null
      );
    } catch (err: any) {
      console.error(err);
      alert("AI 분석을 가져오지 못했습니다. Gemini API 연동 상태를 확인해 주세요.");
    } finally {
      setAiLoading(false);
    }
  };

  const filteredTasks = tasks.filter(task => activeFilter === "전체" || task.type === activeFilter);

  const columns: { title: "To-Do" | "In Progress" | "Peer Review" | "Done"; color: string }[] = [
    { title: "To-Do", color: "var(--muted)" },
    { title: "In Progress", color: "var(--warning)" },
    { title: "Peer Review", color: "var(--primary)" },
    { title: "Done", color: "var(--success)" }
  ];

  return (
    <div className={styles.demoContainer}>
      {/* Top Banner */}
      <div className={styles.demoBanner}>
        <span>⚠️ 현재 화면은 <strong>데이터베이스 연동 전 시뮬레이션 모드(Demo)</strong>입니다. 추가된 정보는 브라우저 새로고침 시 초기화됩니다.</span>
        <Link href="/" className={styles.backHome}>랜딩 홈으로</Link>
      </div>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logoInfo}>
          <span className="gradient-text styles_logo">TeamFlow Demo Board</span>
        </div>
        <div className={styles.filterBar}>
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
      </header>

      <div className={styles.boardLayout}>
        {/* Kanban Board Area */}
        <div className={styles.kanbanColumns}>
          {columns.map(col => {
            const colTasks = filteredTasks.filter(t => t.status === col.title);
            return (
              <div key={col.title} className={styles.column}>
                <div className={styles.columnHeader}>
                  <div className={styles.columnTitle}>
                    <span className={styles.statusDot} style={{ backgroundColor: `hsl(${col.color})` }} />
                    <h4>{col.title}</h4>
                  </div>
                  <span className={styles.taskCount}>{colTasks.length}</span>
                </div>
                <div className={styles.taskContainer}>
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      className={`${styles.taskCard} glass-card`}
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className={styles.cardHeader}>
                        <span className={`${styles.typeBadge} ${styles[task.type]}`}>
                          {task.type}
                        </span>
                        <span className={styles.diffBadge}>난이도: {task.difficulty}</span>
                      </div>
                      <h4 className={styles.taskTitle}>{task.title}</h4>
                      <p className={styles.assigneeText}>👤 {task.assignee}</p>

                      {/* Card Control Buttons */}
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
                    <div className={styles.emptyColumn}>태스크가 없습니다.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Creation Form */}
        <div className={`${styles.sidebar} glass-card`}>
          <h3>➕ 로컬 태스크 생성</h3>
          <form onSubmit={handleAddTask} className={styles.taskForm}>
            <div className={styles.formGroup}>
              <label>태스크 제목</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="어떤 작업을 해야 하나요?"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>담당자</label>
              <input
                type="text"
                value={newAssignee}
                onChange={e => setNewAssignee(e.target.value)}
                placeholder="이름 (예: 홍길동)"
              />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>역할군</label>
                <select value={newType} onChange={e => setNewType(e.target.value as any)}>
                  <option value="기획">기획</option>
                  <option value="데이터">데이터</option>
                  <option value="모델">모델</option>
                  <option value="개발">개발</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>난이도</label>
                <select value={newDifficulty} onChange={e => setNewDifficulty(e.target.value as any)}>
                  <option value="상">상</option>
                  <option value="중">중</option>
                  <option value="하">하</option>
                </select>
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>상세 내용</label>
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="구체적인 진행 계획이나 필요한 협업 사항을 적어보세요."
                rows={3}
              />
            </div>
            <button type="submit" className="btn-primary">태스크 추가</button>
          </form>
        </div>
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <div className={styles.modalOverlay} onClick={() => setSelectedTask(null)}>
          <div className={`${styles.modalContent} glass-card`} onClick={e => e.stopPropagation()}>
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
              <p><strong>담당자:</strong> {selectedTask.assignee}</p>
              <p><strong>난이도:</strong> {selectedTask.difficulty}</p>
              <p><strong>현재 상태:</strong> {selectedTask.status}</p>
            </div>
            <div className={styles.modalBody}>
              <h4>상세 내용</h4>
              <p>{selectedTask.description}</p>
            </div>

            {/* AI Assistant Section */}
            <div className={styles.aiSection}>
              <h4>🤖 AI 협업 분석 가이드</h4>
              {selectedTask.aiFeedback ? (
                <div className={styles.aiFeedbackBox}>
                  <p>{selectedTask.aiFeedback}</p>
                </div>
              ) : (
                <div className={styles.aiActionBox}>
                  <p>이 작업을 전공자와 비전공자 중 누가 수행하는 게 효율적인지 AI에게 물어보세요.</p>
                  <button
                    onClick={() => runAiAnalysis(selectedTask)}
                    className="btn-primary"
                    disabled={aiLoading}
                  >
                    {aiLoading ? "AI 분석 분석 중..." : "AI 작업 적합도 판별 요청"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
