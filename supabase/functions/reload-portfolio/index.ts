const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

export async function reload(request: Request): Promise<Response> {
  const reply = (status: number) => new Response(null, { status, headers });
  if (request.method === "OPTIONS") return reply(204);
  if (request.method !== "POST") return reply(405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401);
  const owner = Deno.env.get("PORTFOLIO_OWNER_ID");
  const token = Deno.env.get("PORTFOLIO_ACTIONS_TOKEN");
  if (!owner || !token) return reply(503);

  try {
    const auth = await fetch(Deno.env.get("SUPABASE_URL") + "/auth/v1/user", {
      headers: { Authorization: authorization, apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
    });
    if (!auth.ok) return reply(auth.status >= 500 ? 502 : 401);
    if ((await auth.json()).id !== owner) return reply(403);

    const run = await fetch("https://api.github.com/repos/cngphm07/portfolio/actions/workflows/deploy.yml/dispatches", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "portfolio-tools",
      },
      body: JSON.stringify({ ref: "main" }),
    });
    return reply(run.ok ? 202 : 502);
  } catch {
    return reply(502);
  }
}

Deno.serve(reload);
