// Roles allowed to connect to the MCP server (REALIZA-295): every program
// role connects — the fine-grained allowlist lives in each tool's `roles`.
// The gate is only "has a role in the program", not staff-only. Single
// source shared by /api/mcp (403 gate) and the PAT surfaces (the profile
// pages hide the section for a role-less profile: a token issued there
// would get 403 anyway).
import type { AppRole } from "@/lib/types";

export const PAPEIS_MCP: readonly AppRole[] = [
  "coordenacao",
  "supervisor",
  "mentor_dpp",
  "mentor_especialista",
  "mentorado",
];
