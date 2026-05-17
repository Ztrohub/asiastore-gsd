export type SeedUser = {
  username: string;
  role: "OWNER" | "CASHIER";
};

export const defaultSeedUsers: SeedUser[] = [
  { username: "owner", role: "OWNER" },
  { username: "cashier", role: "CASHIER" },
];
