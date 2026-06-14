export type Database = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public: { Tables: Record<string, any>; Views: Record<string, any>; Functions: Record<string, any> };
};
