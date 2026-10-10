import type { UserProfileRow } from "../types";

/** 他の利用者に見せるプロフィール。メールアドレスは含めない(識別には公開IDを使う) */
export interface PublicUserProfileDTO {
  id: string;
  displayName: string;
  givenName: string | null;
  surname: string | null;
  companyName: string | null;
  jobTitle: string | null;
  department: string | null;
  employeeType: string | null;
}

/** 本人に返すプロフィール(本人のメールアドレスを含む) */
export interface UserProfileDTO extends PublicUserProfileDTO {
  email: string;
}

export function toPublicUserProfileDTO(row: UserProfileRow): PublicUserProfileDTO {
  return {
    id: row.public_id,
    displayName: row.display_name,
    givenName: row.given_name,
    surname: row.surname,
    companyName: row.company_name,
    jobTitle: row.job_title,
    department: row.department,
    employeeType: row.employee_type,
  };
}

export function toUserProfileDTO(row: UserProfileRow): UserProfileDTO {
  return { ...toPublicUserProfileDTO(row), email: row.email };
}

export const USER_PROFILE_COLUMNS =
  "email, public_id, display_name, given_name, surname, company_name, job_title, department, employee_type";

export async function fetchUserProfileRow(db: D1Database, email: string): Promise<UserProfileRow | null> {
  return db
    .prepare(`SELECT ${USER_PROFILE_COLUMNS} FROM users WHERE email = ?`)
    .bind(email)
    .first<UserProfileRow>();
}

export async function fetchUserProfileRowByPublicId(db: D1Database, publicId: string): Promise<UserProfileRow | null> {
  return db
    .prepare(`SELECT ${USER_PROFILE_COLUMNS} FROM users WHERE public_id = ?`)
    .bind(publicId)
    .first<UserProfileRow>();
}

/** 会員登録時に割り当てる公開ID(16桁の16進数。マイグレーション0017の既存ユーザーへの割り当てと同じ形式) */
export function generatePublicId(): string {
  return [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
