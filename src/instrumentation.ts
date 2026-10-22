/**
 * Runs once when the server starts. Configuration mistakes should stop the
 * deploy, not surface as a broken sign-in for the first person who tries.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const problems: string[] = [];

  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    problems.push(
      "AUTH_SECRET is missing or too short. Sessions cannot be signed safely.\n" +
        "  Generate one with:  openssl rand -base64 48"
    );
  }
  if (!process.env.DATABASE_URL) {
    problems.push('DATABASE_URL is not set. For SQLite use:  DATABASE_URL="file:./prisma/dev.db"');
  }

  if (problems.length) {
    throw new Error(
      `\n\nNourish cannot start — ${problems.length} configuration problem${problems.length > 1 ? "s" : ""}:\n\n` +
        problems.map((p) => `  • ${p}`).join("\n\n") +
        "\n\nSee .env.example.\n"
    );
  }

  if (!process.env.GROQ_API_KEY) {
    console.warn(
      "[nourish] GROQ_API_KEY is not set — AI estimation, photo logging, suggestions and coaching are disabled."
    );
  }
}
