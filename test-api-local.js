const main = async () => {
  try {
    const res = await fetch("http://localhost:3000/api/tasks/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "로그인 기능 개발",
        description: "사용자 인터페이스 구현부터 백엔드 인증 로직 및 데이터베이스 연동 개발",
      }),
    });
    const data = await res.json();
    console.log("STATUS:", res.status);
    console.log("DATA:\n", data.aiFeedback);
  } catch (err) {
    console.error("ERROR:", err);
  }
};
main();
