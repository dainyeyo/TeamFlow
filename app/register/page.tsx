"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("Active Member");
  const [specialty, setSpecialty] = useState("Planning");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 비밀번호 정규식 검증: 영문, 숫자 포함 9자리 이상
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{9,}$/;
    if (!passwordRegex.test(password)) {
      setError("비밀번호는 영문과 숫자를 혼용하여 최소 9자리 이상 입력해야 합니다.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          specialty,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "회원가입 실패");
      }

      alert("회원가입이 완료되었습니다. 로그인해 주세요!");
      router.push("/login");
    } catch (err: any) {
      setError(err.message || "회원가입 처리 중 에러가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.glowingOrb} />
      <div className={styles.glowingOrbAccent} />

      <div className={`${styles.authCard} glass-card`}>
        <div className={styles.authHeader}>
          <h2>
            <span className="gradient-text">TeamFlow</span> 회원가입
          </h2>
          <p>새로운 협업의 시작을 경험하세요</p>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.authForm}>
          <div className={styles.formGroup}>
            <label htmlFor="name">이름 (실명 권장)</label>
            <input
              id="name"
              type="text"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">이메일 주소</label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="role">프로젝트 역할</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={loading}
              >
                <option value="Active Member">팀원 (Active)</option>
                <option value="Team Leader">팀장 (Leader)</option>
                <option value="Mentor">멘토 (Mentor)</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="specialty">전문 분야</label>
              <select
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                disabled={loading}
              >
                <option value="Planning">기획 / PM</option>
                <option value="AI">AI 모델링</option>
                <option value="Frontend">프론트엔드</option>
                <option value="Backend">백엔드</option>
                <option value="Design">디자인</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">비밀번호 (영문+숫자 포함 9자 이상)</label>
            <input
              id="password"
              type="password"
              placeholder="영문, 숫자 혼합 9자 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">비밀번호 확인</label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="비밀번호 재입력"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "가입 처리 중..." : "회원가입"}
          </button>
        </form>

        <div className={styles.authFooter}>
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className={styles.authLink}>
            로그인하기
          </Link>
        </div>
      </div>
    </div>
  );
}
