export const TOKEN_KEY = "entregaja.accessToken";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const token =
    options.token === undefined
      ? sessionStorage.getItem(TOKEN_KEY)
      : options.token;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      "Não foi possível conectar ao servidor. Confira se o sistema local está iniciado.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token)
      window.dispatchEvent(new Event("entregaja:unauthorized"));
    const message = Array.isArray(data?.message)
      ? data.message.join(" ")
      : data?.message;
    throw new ApiError(
      response.status,
      typeof message === "string"
        ? message
        : "Não foi possível concluir a operação. Tente novamente.",
    );
  }
  return data as T;
}
