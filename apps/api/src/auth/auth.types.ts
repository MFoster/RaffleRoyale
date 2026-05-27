export type AuthRole = 'USER' | 'ADMIN';

export type AuthContext = {
  userId: string;
  role: AuthRole;
};
