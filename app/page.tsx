"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

interface Workspace {
  id: string;
  name: string;
  inviteCode: string;
  projects: Array<{ id: string; name: string }>;
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  
  // 폼 상태
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", isError: false });

  // 로그인 상태일 때 워크스페이스 조회
  useEffect(() => {
    if (status === "authenticated") {
      fetchWorkspaces();
    }
  }, [status]);

  const fetchWorkspaces = async () => {
    setLoadingWorkspaces(true);
    try {
      const response = await fetch("/api/workspaces");
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data);
      }
    } catch (err) {
      console.error("워크스페이스 로드 실패:", err);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  // 새로운 팀(워크스페이스) 생성
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setActionLoading(true);
    setMessage({ text: "", isError: false });

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: newTeamName }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "팀 생성 실패");

      setMessage({ text: `🎉 팀 '${newTeamName}'이(가) 성공적으로 생성되었습니다! 초대 코드: ${data.workspace.inviteCode}`, isError: false });
      setNewTeamName("");
      fetchWorkspaces();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  // 초대 코드로 팀 참여
  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;

    setActionLoading(true);
    setMessage({ text: "", isError: false });

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", inviteCode: inviteCodeInput }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "팀 가입 실패");

      setMessage({ text: "🚀 성공적으로 팀에 합류하였습니다!", isError: false });
      setInviteCodeInput("");
      fetchWorkspaces();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
        <p>세션 정보를 불러오는 중...</p>
      </div>
    );
  }

  // 1. 로그인 상태인 경우의 대시보드 화면
  if (status === "authenticated") {
    return (
      <div className={styles.container}>
        <div className={styles.glowingOrb} />
        <div className={styles.glowingOrbAccent} />

        <header className={styles.header}>
          <div className={styles.logo}>
            <span className="gradient-text">TeamFlow</span>
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userBadge}>
              👤 {session.user?.name} ({session.user?.role === "Team Leader" ? "PM" : session.user?.role === "Mentor" ? "총괄 매니저" : "팀원"})
            </span>
            <button onClick={() => signOut()} className={styles.btnSecondary}>
              로그아웃
            </button>
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.dashboardSection}>
            <h1 className={`${styles.title} gradient-text`}>나의 협업 워크스페이스</h1>
            <p className={styles.subtitle}>팀을 선택해 칸반 보드로 진입하거나 새로운 프로젝트 팀을 구축하세요.</p>

            {message.text && (
              <div className={`${styles.statusMessage} ${message.isError ? styles.errorMsg : styles.successMsg}`}>
                {message.text}
              </div>
            )}

            <div className={styles.workspaceGrid}>
              {/* 워크스페이스 목록 */}
              <div className={styles.workspaceListColumn}>
                <h2>소속된 프로젝트 팀 ({workspaces.length})</h2>
                {loadingWorkspaces ? (
                  <p className={styles.infoText}>워크스페이스 불러오는 중...</p>
                ) : workspaces.length === 0 ? (
                  <div className={`${styles.emptyCard} glass-card`}>
                    <p>현재 가입된 프로젝트 팀이 없습니다.</p>
                    <p>오른쪽 메뉴에서 새로운 팀을 만들거나 초대 코드를 입력하여 참여해 보세요!</p>
                  </div>
                ) : (
                  <div className={styles.cardContainer}>
                    {workspaces.map((team) => (
                      <div key={team.id} className={`${styles.teamCard} glass-card`}>
                        <div className={styles.teamCardHeader}>
                          <h3>{team.name}</h3>
                          <span className={styles.codeBadge}>초대코드: {team.inviteCode}</span>
                        </div>
                        <p className={styles.teamProjectDesc}>
                          {team.projects?.[0]?.name || "기본 프로젝트"}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button
                            onClick={() => router.push(`/board?workspaceId=${team.id}`)}
                            className="btn-primary"
                            style={{ flex: 1 }}
                          >
                            칸반 보드 ➔
                          </button>
                          {(session.user?.role === "Mentor" || session.user?.role === "Team Leader") && (
                            <button
                              onClick={() => router.push(`/board/mentor?workspaceId=${team.id}`)}
                              className={styles.btnSecondary}
                              style={{ padding: '8px 12px', fontSize: '13px' }}
                            >
                              🛡️ AI 총괄 진단 뷰
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 생성/가입 사이드바 */}
              <div className={styles.actionSidebar}>
                <div className={`${styles.sidebarCard} glass-card`}>
                  <h3>➕ 새로운 프로젝트 팀 생성</h3>
                  <form onSubmit={handleCreateTeam} className={styles.sidebarForm}>
                    <input
                      type="text"
                      placeholder="프로젝트 팀 이름 (예: AI 어시스턴트 A조)"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      required
                      disabled={actionLoading}
                    />
                    <button type="submit" className="btn-primary" disabled={actionLoading}>
                      팀 생성 및 코드 발급
                    </button>
                  </form>
                </div>

                <div className={`${styles.sidebarCard} glass-card`}>
                  <h3>🔑 초대 코드로 팀 참여</h3>
                  <form onSubmit={handleJoinTeam} className={styles.sidebarForm}>
                    <input
                      type="text"
                      placeholder="초대 코드 입력 (6자리 알파벳/숫자)"
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value)}
                      required
                      disabled={actionLoading}
                    />
                    <button type="submit" className={styles.btnSecondary} disabled={actionLoading}>
                      참여 코드로 가입
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          <p>© 2026 TeamFlow. 기업 실무 부서용 프리미엄 애자일 프로젝트 관리 시스템</p>
        </footer>
      </div>
    );
  }

  // 2. 비로그인 상태인 경우의 랜딩 페이지 화면
  return (
    <div className={styles.container}>
      <div className={styles.glowingOrb} />
      <div className={styles.glowingOrbAccent} />

      <header className={styles.header}>
        <div className={styles.logo}>
          <span className="gradient-text">TeamFlow</span>
        </div>
        <nav className={styles.nav}>
          <a href="#features" className={styles.navLink}>주요 기능</a>
          <Link href="/login" className={styles.navLink}>로그인</Link>
        </nav>
        <div>
          <Link href="/register">
            <button className="btn-primary">회원가입</button>
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.badge}>
            <span>Enterprise Agile Edition 🚀</span>
          </div>
          <h1 className={`${styles.title} gradient-text`}>
            기술과 비기술 부서의<br />
            협업 병목을 허물다
          </h1>
          <p className={styles.subtitle}>
            비기술 직군 기획/디자이너부터 개발/엔지니어까지, 부서 전체의 업무 흐름을 한눈에 매핑하고 AI 코칭을 결합한 프리미엄 애자일 칸반 시스템
          </p>
          <div className={styles.heroActions}>
            <Link href="/login">
              <button className="btn-primary">시작하기 (로그인)</button>
            </Link>
            <Link href="/demo">
              <button className={styles.btnSecondary}>데모 보드 맛보기</button>
            </Link>
          </div>
        </section>

        <section id="features" className={styles.features}>
          <h2 className={styles.sectionTitle}>실무 팀을 위한 최적화 기능</h2>
          <div className={styles.grid}>
            <div className="glass-card">
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>📊</div>
                <h3>실무 분야 필터링 칸반</h3>
              </div>
              <p>기획, 데이터, 모델링, 개발 등 영역별로 태스크를 필터링하여 대규모 태스크 상황에서도 복잡성을 최소화합니다.</p>
            </div>

            <div className="glass-card">
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>⚙️</div>
                <h3>하이브리드 워크플로우</h3>
              </div>
              <p>개발 조직은 GitHub PR 연동으로 카드를 자동 관리하고, 기획/디자인 파트는 드래그 앤 드롭으로 쉽고 유연하게 상태를 업데이트합니다.</p>
            </div>

            <div className="glass-card">
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>🤖</div>
                <h3>AI 협업 진단 & 애자일 코칭</h3>
              </div>
              <p>AI가 업무 내용을 자동 분석해 기술적 난이도를 예측 태깅하고, 일일 협업 상태를 진단하여 실질적인 애자일 가이드를 제시합니다.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>© 2026 TeamFlow. 기업 실무 부서용 프리미엄 애자일 프로젝트 관리 시스템</p>
      </footer>
    </div>
  );
}
