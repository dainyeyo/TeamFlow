"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "./page.module.css";

interface MentorStats {
  total: number;
  done: number;
  todo: number;
  inProgress: number;
  peerReview: number;
  planning: number;
  data: number;
  model: number;
  dev: number;
}

interface MentorComment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    name: string;
    specialty: string;
  };
  task: {
    title: string;
  };
}

function MentorDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId");
  const { data: session, status: sessionStatus } = useSession();

  const [stats, setStats] = useState<MentorStats | null>(null);
  const [healthScore, setHealthScore] = useState<number>(100);
  const [aiReport, setAiReport] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [mentorComments, setMentorComments] = useState<MentorComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workspaceName, setWorkspaceName] = useState("워크스페이스");

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (sessionStatus === "authenticated" && session.user.role !== "Mentor" && session.user.role !== "Team Leader") {
      alert("멘토 또는 팀장 권한을 소유한 사용자만 접근 가능한 진단 뷰입니다.");
      router.push("/");
    }
  }, [sessionStatus, session, router]);

  useEffect(() => {
    if (!workspaceId) {
      router.push("/");
      return;
    }

    const fetchMentorReport = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/reports/mentor?workspaceId=${workspaceId}`);
        if (!response.ok) throw new Error("보고서 로드 실패");
        const data = await response.json();

        setStats(data.stats);
        setHealthScore(data.healthScore);
        setAiReport(data.aiReport);
        setSuggestions(data.suggestions);
        setMentorComments(data.mentorComments);

        const wsResponse = await fetch("/api/workspaces");
        if (wsResponse.ok) {
          const workspaces = await wsResponse.json();
          const currentWs = workspaces.find((w: any) => w.id === workspaceId);
          if (currentWs) setWorkspaceName(currentWs.name);
        }
      } catch (err: any) {
        console.error(err);
        setError("멘토 보고서를 로드하는 도중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        setLoading(false);
      }
    };

    if (sessionStatus === "authenticated") {
      fetchMentorReport();
    }
  }, [workspaceId, sessionStatus, router]);

  if (error) {
    return (
      <div className={styles.loadingBox}>
        <span style={{ fontSize: '32px' }}>⚠️</span>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="btn-primary" style={{ marginTop: "12px" }}>
          다시 시도
        </button>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className={styles.loadingBox}>
        <div className={styles.spinner} />
        <p>멘토 전용 AI 팀 협업 진단서를 생성하는 중...</p>
      </div>
    );
  }

  const completionRate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div>
          <span style={{ fontSize: '13px', color: 'hsl(var(--accent))', fontWeight: '600', textTransform: 'uppercase' }}>Mentor Evaluation Mode 🛡️</span>
          <h1 className="gradient-text">{workspaceName} - 협업 종합 진단</h1>
        </div>
        <button onClick={() => router.push(`/board?workspaceId=${workspaceId}`)} className={styles.backBtn}>
          팀 칸반 보드로 진입
        </button>
      </div>

      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} glass-card`}>
          <span>총 태스크 현황</span>
          <h2>{stats.total}개</h2>
          <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
            Done {stats.done} / Review {stats.peerReview} / Active {stats.inProgress + stats.todo}
          </p>
        </div>

        <div className={`${styles.statCard} glass-card`}>
          <span>프로젝트 완료율</span>
          <h2>{completionRate}%</h2>
          <div style={{ width: '100%', height: '6px', background: 'hsl(var(--border))', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
            <div style={{ width: `${completionRate}%`, height: '100%', background: 'hsl(var(--accent))', boxShadow: 'var(--neon-accent-glow)' }} />
          </div>
        </div>

        <div className={`${styles.statCard} glass-card`}>
          <span>전공자 태스크 (모델/개발)</span>
          <h2>{stats.model + stats.dev}개</h2>
          <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
            모델링 {stats.model}개 | 개발 코딩 {stats.dev}개
          </p>
        </div>

        <div className={`${styles.statCard} glass-card`}>
          <span>비전공자 태스크 (기획/데이터)</span>
          <h2>{stats.planning + stats.data}개</h2>
          <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
            기획안 {stats.planning}개 | 데이터셋 {stats.data}개
          </p>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div className={`${styles.card} glass-card`}>
          <h3>🤖 AI 협업 진단서 & 코칭 제안</h3>
          
          <div className={styles.healthSection}>
            <div className={styles.scoreCircle} style={{ 
              borderColor: healthScore >= 80 ? 'hsl(var(--success))' : healthScore >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
              boxShadow: healthScore >= 80 ? '0 0 15px hsla(142, 70%, 45%, 0.3)' : healthScore >= 50 ? '0 0 15px hsla(38, 92%, 50%, 0.3)' : '0 0 15px hsla(0, 84%, 60%, 0.3)'
            }}>
              {healthScore}점
            </div>
            <div className={styles.healthText}>
              <strong>협업 건강 지수</strong>
              <p>기획과 기술 태스크의 밸런스 및 병목 구간 분석 점수</p>
            </div>
          </div>

          <div className={styles.reportBox}>
            {aiReport}
          </div>

          <div style={{ marginTop: '12px' }}>
            <strong style={{ fontSize: '14px', color: 'hsl(var(--primary))' }}>💡 권장 멘토 피드백 제안:</strong>
            <ul className={styles.suggestionList}>
              {suggestions.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className={`${styles.card} glass-card`}>
          <h3>📢 멘토 코칭 피드백 타임라인 ({mentorComments.length})</h3>
          
          <div className={styles.commentsTimeline}>
            {mentorComments.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'hsl(var(--muted))', textAlign: 'center', padding: '48px 0' }}>
                아직 칸반 보드에 작성된 멘토 피드백 코멘트가 없습니다.<br />
                칸반 모달창에서 댓글을 남기면 여기에 모아져 타임라인으로 표시됩니다.
              </p>
            ) : (
              mentorComments.map(c => (
                <div key={c.id} className={`${styles.commentItem} glass-card`} style={{ border: '1px solid hsl(var(--border) / 0.7)' }}>
                  <div className={styles.commentMeta}>
                    <span>
                      <strong>{c.author.name} 멘토</strong> ({c.author.specialty})
                    </span>
                    <span>
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ marginTop: '2px' }}>
                    <span className={styles.taskLabel}>대상 태스크: {c.task.title}</span>
                  </div>
                  <p className={styles.commentBody}>{c.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MentorDashboardPage() {
  return (
    <div className={styles.container}>
      <div className={styles.glowingOrb} />
      <div className={styles.glowingOrbAccent} />
      <Suspense fallback={
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <p>화면 데이터를 가져오는 중...</p>
        </div>
      }>
        <MentorDashboardContent />
      </Suspense>
    </div>
  );
}
