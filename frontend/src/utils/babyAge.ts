export const monthsBetween = (fromIso: string, toIso?: string): number | null => {
  if (!fromIso) return null;
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return null;
  const to = toIso ? new Date(toIso) : new Date();
  if (Number.isNaN(to.getTime())) return null;
  const days = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
  return Math.floor(days / 30);
};
