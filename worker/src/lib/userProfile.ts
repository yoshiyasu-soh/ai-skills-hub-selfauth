import type { UserProfileRow } from "../types";

export interface UserProfileDTO {
  email: string;
  displayName: string;
}

export function toUserProfileDTO(row: UserProfileRow): UserProfileDTO {
  return {
    email: row.email,
    displayName: row.display_name,
  };
}

export const USER_PROFILE_COLUMNS = "email, display_name";

export async function fetchUserProfileRow(db: D1Database, email: string): Promise<UserProfileRow | null> {
  return db
    .prepare(`SELECT ${USER_PROFILE_COLUMNS} FROM users WHERE email = ?`)
    .bind(email)
    .first<UserProfileRow>();
}
