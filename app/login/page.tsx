"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../auth.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError(res.error || "로그인 중 오류가 발생했습니다.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError("로그인 처리 중 예기치 못한 에러가 발생했습니다.");
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
            <span className="gradient-text">TeamFlow</span> 로그인
          </h2>
          <p>AI 프로젝트 협업 관리 플랫폼</p>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.authForm}>
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

          <div className={styles.formGroup}>
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className={styles.authFooter}>
          계정이 없으신가요?{" "}
          <Link href="/register" className={styles.authLink}>
            회원가입하기
          </Link>
        </div>
      </div>
    </div>
  );
}
