type DbError = { code?: string; message?: string } | null | undefined;

export function toUserError(error: DbError, fallback = "Noe gikk galt. Prøv igjen."): string {
  if (!error) return fallback;
  switch (error.code) {
    case "23505":
      return "Dette finnes allerede.";
    case "23503":
      return "Kan ikke fullføre fordi andre data er koblet til dette.";
    case "23514":
      return "Verdien er ikke gyldig.";
    case "42501":
      return "Du har ikke tilgang til å gjøre dette.";
    case "P0001":
      return error.message || fallback;
    default:
      return fallback;
  }
}
