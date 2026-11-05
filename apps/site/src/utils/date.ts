const formatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "long",
  timeZone: "UTC",
});

export function formatDate(date: string): string {
  return formatter.format(new Date(date));
}
