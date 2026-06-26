"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId");

  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workspaceId) {
      router.push("/");
      return;
    }

    const fetchReport = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/reports/daily?workspaceId=${workspaceId}`);
        if (!response.ok) throw new Error("보고서 조회 실패");
        const data = await response.json();
        setReport(data.report || "생성된 보고서가 없습니다.");
      } catch (err: any) {
        console.error(err);
        setError("보고서를 생성하는 도중 오류가 발생했습니다. Gemini API 연동 상태를 확인해 주세요.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [workspaceId, router]);

  const renderMarkdown = (markdown: string) => {
    return markdown.split("\n").map((line, index) => {
      if (line.startsWith("## ")) {
        return (
          <h2 key={index} style={{ marginTop: "28px", marginBottom: "14px", fontSize: "22px", color: "hsl(var(--accent))", fontWeight: "700" }}>
            {line.replace("## ", "")}
          </h2>
        );
      }
      if (line.startsWith("### ")) {
        return (
          <h3 key={index} style={{ marginTop: "20px", marginBottom: "10px", fontSize: "18px", fontWeight: "600" }}>
            {line.replace("### ", "")}
          </h3>
        );
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        const cleanLine = line.replace(/^[-*]\s+/, "");
        return (
          <li key={index} style={{ marginLeft: "24px", marginBottom: "8px", fontSize: "15px", lineHeight: "1.6", color: "hsl(var(--muted-foreground))" }}
              dangerouslySetInnerHTML={{ __html: cleanLine.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }}
          />
        );
      }
      if (line.trim() === "") {
        return <div key={index} style={{ height: "12px" }} />;
      }
      return (
        <p key={index} style={{ marginBottom: "10px", fontSize: "15px", lineHeight: "1.6", color: "hsl(var(--foreground))" }}
           dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }}
        />
      );
    });
  };

  if (loading) {
    return (
      <div className={styles.loadingBox}>
        <div className={styles.spinner} />
        <p>Gemini가 오늘 완료된 태스크를 심층 분석하여 데일리 요약 보고서를 작성 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.loadingBox}>
        <span>⚠️</span>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="btn-primary" style={{ marginTop: "12px" }}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={styles.header}>
        <h1>📋 AI 데일리 랩업 요약 보고서</h1>
        <button onClick={() => router.push(`/board?workspaceId=${workspaceId}`)} className={styles.backBtn}>
          칸반 보드로 돌아가기
        </button>
      </div>

      <div className={styles.reportContent}>
        {renderMarkdown(report)}
      </div>

      <div className={styles.actionRow}>
        <button onClick={() => window.print()} className="btn-primary">
          🖨️ 보고서 인쇄 / PDF 저장
        </button>
      </div>
    </>
  );
}

export default function DailyReportPage() {
  return (
    <div className={styles.container}>
      <div className={styles.glowingOrb} />
      <div className={styles.glowingOrbAccent} />

      <div className={`${styles.card} glass-card`}>
        <Suspense fallback={
          <div className={styles.loadingBox}>
            <div className={styles.spinner} />
            <p>화면을 준비하는 중...</p>
          </div>
        }>
          <ReportContent />
        </Suspense>
      </div>
    </div>
  );
}
