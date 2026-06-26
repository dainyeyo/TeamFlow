import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { name, email, password, role, specialty } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "필수 입력 항목이 누락되었습니다." },
        { status: 400 }
      );
    }

    // 비밀번호 정규식 검증: 영문, 숫자 포함 9자리 이상
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{9,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { error: "비밀번호는 영문과 숫자를 포함하여 최소 9자리 이상이어야 합니다." },
        { status: 400 }
      );
    }

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "이미 가입된 이메일 주소입니다." },
        { status: 400 }
      );
    }

    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 등록
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || "Active Member",
        specialty: specialty || "Planning",
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        specialty: user.specialty,
      },
    });
  } catch (error: any) {
    console.error("Register Error:", error);
    return NextResponse.json(
      { error: "회원가입 처리 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    );
  }
}
