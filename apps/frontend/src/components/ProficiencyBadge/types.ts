// Shared prop contract for every proficiency badge variant so the dispatcher can forward props generically.
export type BadgeVariantProps = {
  level: number;
  small?: boolean;
};
