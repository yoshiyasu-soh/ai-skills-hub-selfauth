import type { UserProfileRow } from "../types";

export interface UserProfileDTO {
  email: string;
  displayName: string;
  givenName: string | null;
  surname: string | null;
  companyName: string | null;
  jobTitle: string | null;
  department: string | null;
  employeeType: string | null;
}

export function toUserProfileDTO(row: UserProfileRow): UserProfileDTO {
  return {
    email: row.email,
    displayName: row.display_name,
    givenName: row.given_name,
    surname: row.surname,
    companyName: row.company_name,
    jobTitle: row.job_title,
    department: row.department,
    employeeType: row.employee_type,
  };
}

export const USER_PROFILE_COLUMNS =
  "email, display_name, given_name, surname, company_name, job_title, department, employee_type";

export async function fetchUserProfileRow(db: D1Database, email: string): Promise<UserProfileRow | null> {
  return db
    .prepare(`SELECT ${USER_PROFILE_COLUMNS} FROM users WHERE email = ?`)
    .bind(email)
    .first<UserProfileRow>();
}
