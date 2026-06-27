// Lightweight health check for the host (Render/Fly) — always 200, no auth, no DB.
export const loader = () => new Response("ok", { status: 200 });
