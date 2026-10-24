import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bike,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  Truck,
  UserRound,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { api, ApiError, TOKEN_KEY } from "./api";
import type {
  Courier,
  Delivery,
  Quote,
  Role,
  Shift,
  Status,
  Summary,
  User,
} from "./types";

const money = (value: string | number = 0) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value),
  );
const date = (value: string, withTime = true) =>
  new Date(value).toLocaleString(
    "pt-BR",
    withTime
      ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short", year: "numeric" },
  );
const shortId = (id: string) =>
  `#${id.slice(0, 4).toUpperCase()}-${id.slice(-4).toUpperCase()}`;
const statusNames: Record<Status, string> = {
  PENDING: "Pendente",
  SEARCHING: "Buscando motoboy",
  ASSIGNED: "Motoboy a caminho",
  PICKED_UP: "Coletada",
  IN_TRANSIT: "Em trânsito",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelada",
};
const roleNames: Record<Role, string> = {
  ADMIN: "Administrador",
  CUSTOMER: "Cliente",
  COURIER: "Motoboy",
};
const activeStatuses: Status[] = ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"];
const terminalStatuses: Status[] = ["DELIVERED", "CANCELLED"];
const nextStatus: Partial<Record<Status, Status>> = {
  ASSIGNED: "PICKED_UP",
  PICKED_UP: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
};
const nextLabels: Partial<Record<Status, string>> = {
  ASSIGNED: "Confirmar coleta",
  PICKED_UP: "Iniciar trajeto",
  IN_TRANSIT: "Confirmar entrega",
};
type Page =
  | "overview"
  | "deliveries"
  | "new"
  | "available"
  | "couriers"
  | "shifts"
  | "users"
  | "apply"
  | "my-shift";
type Data = {
  deliveries: Delivery[];
  available: Delivery[];
  couriers: Courier[];
  shifts: Shift[];
  users: User[];
  summary: Summary | null;
  profile: Courier | null;
};
const initialData: Data = {
  deliveries: [],
  available: [],
  couriers: [],
  shifts: [],
  users: [],
  summary: null,
  profile: null,
};

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "light" : ""}`}>
      <span className="brand-symbol">
        <Bike size={25} strokeWidth={2.3} />
      </span>
      <span>
        entrega<span className="brand-accent">já</span>
        <span className="brand-dot">.</span>
      </span>
    </div>
  );
}

function Badge({ status }: { status: Status }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      <span className="badge-dot" />
      {statusNames[status]}
    </span>
  );
}
function Empty({
  title = "Nada por aqui, por enquanto",
  children,
  icon = <Package size={30} />,
}: {
  title?: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{children ?? "Assim que houver novidades, elas aparecerão aqui."}</p>
    </div>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Auth({
  onLogin,
  notice,
}: {
  onLogin: (token: string, user: User) => void;
  notice: string;
}) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const demo = import.meta.env.VITE_DEMO_MODE !== "false";
  async function submit(event?: FormEvent, demoEmail?: string) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (register && !demoEmail)
        await api("/auth/register", {
          method: "POST",
          token: null,
          body: { name, email, password, ...(phone ? { phone } : {}) },
        });
      const result = await api<{ accessToken: string; user: User }>(
        "/auth/login",
        {
          method: "POST",
          token: null,
          body: {
            email: demoEmail ?? email,
            password: demoEmail ? "EntregaLocal123!" : password,
          },
        },
      );
      onLogin(result.accessToken, result.user);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível entrar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand light />
        <div className="auth-story-content">
          <span className="eyebrow light-eyebrow">
            <span className="live-dot" />
            CONEXÕES QUE MOVEM A CIDADE
          </span>
          <h1>
            Do primeiro
            <br />
            pedido ao
            <br />
            <span>último destino.</span>
          </h1>
          <p>
            Clientes, motoboys e sua operação.
            <br />
            Todo mundo na mesma direção.
          </p>
          <div className="auth-route">
            <div>
              <span>
                <Package size={23} />
              </span>
              <b>Solicitou</b>
            </div>
            <i />
            <div>
              <span>
                <Bike size={25} />
              </span>
              <b>Conectou</b>
            </div>
            <i />
            <div>
              <span>
                <Check size={24} />
              </span>
              <b>Entregou</b>
            </div>
          </div>
        </div>
        <div className="auth-footer">
          <ShieldCheck size={16} />
          Sua operação, organizada em um só lugar.
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">BEM-VINDO AO ENTREGAJÁ</span>
          <h2>
            {register
              ? "Seu próximo destino começa aqui."
              : "Bom ter você por aqui."}
          </h2>
          <p className="muted">
            {register
              ? "Crie sua conta e peça sua primeira entrega."
              : "Entre para acompanhar o que está em movimento."}
          </p>
          <div className="auth-tabs">
            <button
              className={!register ? "active" : ""}
              onClick={() => {
                setRegister(false);
                setError("");
              }}
            >
              Entrar
            </button>
            <button
              className={register ? "active" : ""}
              onClick={() => {
                setRegister(true);
                setError("");
              }}
            >
              Criar conta
            </button>
          </div>
          {(error || notice) && (
            <div className="alert error" role="alert">
              {error || notice}
            </div>
          )}
          <form onSubmit={(event) => void submit(event)} className="auth-form">
            {register && (
              <Field label="Seu nome">
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Como podemos chamar você?"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
            )}
            <Field label="E-mail">
              <input
                required
                type="email"
                maxLength={254}
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            {register && (
              <Field label="Telefone (opcional)">
                <input
                  type="tel"
                  maxLength={30}
                  autoComplete="tel"
                  placeholder="(85) 99999-9999"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </Field>
            )}
            <Field
              label="Senha"
              hint={register ? "Use entre 10 e 64 caracteres." : undefined}
            >
              <input
                required
                type="password"
                minLength={register ? 10 : 1}
                maxLength={64}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder={register ? "Crie uma senha segura" : "Sua senha"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <button
              className="button primary full"
              disabled={busy}
              type="submit"
            >
              {busy
                ? "Conectando…"
                : register
                  ? "Criar conta e entrar"
                  : "Entrar na minha conta"}
              <ArrowRight size={18} />
            </button>
          </form>
          {demo && (
            <div className="demo-box">
              <div className="demo-heading">
                <Sparkles size={16} />
                <strong>Explore o ambiente local</strong>
              </div>
              <p>Contas de demonstração, prontas para testar.</p>
              <div className="demo-buttons">
                {[
                  ["Administrador", "admin"],
                  ["Cliente", "cliente"],
                  ["Motoboy", "motoboy"],
                ].map(([label, emailPrefix]) => (
                  <button
                    key={label}
                    disabled={busy}
                    onClick={() =>
                      void submit(undefined, `${emailPrefix}@entregaja.local`)
                    }
                  >
                    {label}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
              <small>
                Disponíveis quando os dados de demonstração estão habilitados.
              </small>
            </div>
          )}
          <p className="auth-bottom">
            <ShieldCheck size={14} />
            Ambiente local · Seus dados ficam no seu banco.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>("overview");
  const [data, setData] = useState<Data>(initialData);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [confirm, setConfirm] = useState<{
    message: string;
    action: () => Promise<void>;
  } | null>(null);
  const refreshId = useRef(0);
  const logout = useCallback((message = "") => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setData(initialData);
    setPage("overview");
    setSelected(null);
    setNotice(message);
    setError("");
    setSuccess("");
    refreshId.current++;
  }, []);
  useEffect(() => {
    const handler = () =>
      logout("Sua sessão terminou. Entre novamente para continuar.");
    window.addEventListener("entregaja:unauthorized", handler);
    return () => window.removeEventListener("entregaja:unauthorized", handler);
  }, [logout]);
  const refresh = useCallback(
    async (silent = false) => {
      if (!token) return;
      const id = ++refreshId.current;
      if (!silent) setLoading(true);
      try {
        const currentUser = await api<User>("/auth/me");
        const deliveries = await api<Delivery[]>("/deliveries");
        let next: Data = { ...initialData, deliveries };
        if (currentUser.role === "ADMIN") {
          const [summary, couriers, shifts, users] = await Promise.all([
            api<Summary>("/admin/summary"),
            api<Courier[]>("/admin/couriers"),
            api<Shift[]>("/admin/shifts"),
            api<User[]>("/admin/users"),
          ]);
          next = { ...next, summary, couriers, shifts, users };
        } else {
          const result = await api<{ profile: Courier | null }>("/couriers/me");
          next.profile = result.profile;
          if (
            currentUser.role === "COURIER" &&
            result.profile?.isApproved &&
            result.profile.isAvailable
          )
            next.available = await api<Delivery[]>("/deliveries/available");
        }
        if (id !== refreshId.current) return;
        setUser(currentUser);
        setData(next);
        setSelected((previous) =>
          previous
            ? (next.deliveries.find(
                (delivery) => delivery.id === previous.id,
              ) ??
              next.available.find((delivery) => delivery.id === previous.id) ??
              previous)
            : null,
        );
      } catch (error) {
        if (id === refreshId.current)
          setError(
            error instanceof Error
              ? error.message
              : "Erro ao atualizar os dados.",
          );
      } finally {
        if (id === refreshId.current) setLoading(false);
      }
    },
    [token],
  );
  useEffect(() => {
    if (!token) return;
    void refresh();
    const interval = setInterval(() => void refresh(true), 10_000);
    return () => {
      clearInterval(interval);
      refreshId.current++;
    };
  }, [token, refresh]);
  useEffect(() => {
    if (!success) return;
    const timeout = setTimeout(() => setSuccess(""), 6000);
    return () => clearTimeout(timeout);
  }, [success]);
  useEffect(() => {
    if (user?.role === "COURIER" && page === "apply") setPage("overview");
  }, [user?.role, page]);
  useEffect(() => {
    if (!selected && !confirm && !drawer) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setSelected(null);
        setConfirm(null);
        setDrawer(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected, confirm, drawer, busy]);
  useEffect(() => {
    if (!selected && !confirm) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      const dialog = dialogs[dialogs.length - 1];
      const focusable = dialog?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]",
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", trap);
    };
  }, [selected?.id, Boolean(confirm)]);
  function navigate(next: Page) {
    setPage(next);
    setDrawer(false);
    setError("");
  }
  async function mutate(
    path: string,
    method: string,
    message: string,
    body?: unknown,
  ) {
    setBusy(true);
    setError("");
    try {
      await api(path, { method, body });
      setSuccess(message);
      await refresh(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "A operação falhou.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  function confirmAction(message: string, action: () => Promise<void>) {
    setConfirm({ message, action });
  }
  async function detail(delivery: Delivery) {
    try {
      setSelected(await api<Delivery>(`/deliveries/${delivery.id}`));
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 403 &&
        user?.role === "COURIER"
      )
        setSelected(delivery);
      else
        setError(
          error instanceof Error
            ? error.message
            : "Não foi possível abrir a entrega.",
        );
    }
  }
  if (!token)
    return (
      <Auth
        notice={notice}
        onLogin={(newToken, newUser) => {
          sessionStorage.setItem(TOKEN_KEY, newToken);
          setUser(newUser);
          setToken(newToken);
          setNotice("");
        }}
      />
    );
  if (!user)
    return (
      <div className="startup-screen">
        <Brand />
        <div className="spinner" />
        <p>Preparando sua operação…</p>
        {error && (
          <>
            <div className="alert error">{error}</div>
            <button className="button secondary" onClick={() => void refresh()}>
              Tentar novamente
            </button>
            <button className="text-button" onClick={() => logout()}>
              Voltar para o login
            </button>
          </>
        )}
      </div>
    );

  const isAdmin = user.role === "ADMIN";
  const isCourier = user.role === "COURIER";
  const myDeliveries = data.deliveries.filter(
    (delivery) => !isCourier || delivery.courierId === data.profile?.id,
  );
  const customerOrders = data.deliveries.filter(
    (delivery) => delivery.customer?.user.id === user.id,
  );
  const nav: { page: Page; label: string; icon: ReactNode; count?: number }[] =
    isAdmin
      ? [
          {
            page: "overview",
            label: "Visão geral",
            icon: <LayoutDashboard size={19} />,
          },
          {
            page: "deliveries",
            label: "Entregas",
            icon: <Package size={19} />,
          },
          {
            page: "couriers",
            label: "Motoboys",
            icon: <Bike size={19} />,
            count: data.couriers.filter((courier) => !courier.isApproved)
              .length,
          },
          { page: "shifts", label: "Turnos", icon: <Clock3 size={19} /> },
          { page: "users", label: "Usuários", icon: <Users size={19} /> },
        ]
      : [
          {
            page: "overview",
            label: "Visão geral",
            icon: <LayoutDashboard size={19} />,
          },
          ...(isCourier
            ? [
                {
                  page: "available" as Page,
                  label: "Disponíveis",
                  icon: <Search size={19} />,
                  count: data.available.length,
                },
              ]
            : []),
          {
            page: "deliveries",
            label: "Minhas entregas",
            icon: <Package size={19} />,
          },
          { page: "new", label: "Nova entrega", icon: <Plus size={19} /> },
          isCourier
            ? {
                page: "my-shift",
                label: "Meu turno",
                icon: <Clock3 size={19} />,
              }
            : { page: "apply", label: "Ser motoboy", icon: <Bike size={19} /> },
        ];
  const pageTitles: Record<Page, string> = {
    overview: "Visão geral",
    deliveries: isAdmin ? "Entregas" : "Minhas entregas",
    new: "Nova entrega",
    available: "Entregas disponíveis",
    couriers: "Motoboys",
    shifts: "Histórico de turnos",
    users: "Usuários",
    apply: "Seja um motoboy",
    "my-shift": "Meu turno",
  };

  return (
    <div className="app-layout">
      {drawer && (
        <button
          aria-label="Fechar menu"
          className="sidebar-overlay"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside className={`sidebar ${drawer ? "open" : ""}`}>
        <Brand light />
        <div className="workspace-tag">
          <span className="workspace-icon">
            <Package size={18} />
          </span>
          <div>
            <b>Meu espaço</b>
            <small>
              {isAdmin
                ? "Gestão da operação"
                : isCourier
                  ? "Parceiro de entregas"
                  : "Portal do cliente"}
            </small>
          </div>
          <span className="workspace-local">LOCAL</span>
        </div>
        <span className="nav-section">PRINCIPAL</span>
        <nav>
          {nav.map((item) => (
            <button
              key={item.page}
              className={`nav-item ${page === item.page ? "active" : ""}`}
              onClick={() => navigate(item.page)}
            >
              {item.icon}
              <span>{item.label}</span>
              {Boolean(item.count) && <b className="nav-count">{item.count}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={22} />
            <strong>Operação conectada.</strong>
            <p>
              Menos espera.
              <br />
              Mais entregas no destino.
            </p>
          </div>
          <div className="sidebar-user">
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <b>{user.name}</b>
              <small>{roleNames[user.role]}</small>
            </div>
            <button
              title="Sair da conta"
              aria-label="Sair da conta"
              onClick={() => logout()}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="topbar-heading">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setDrawer(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Meu espaço <ChevronRight size={14} />
              <b>{pageTitles[page]}</b>
            </span>
          </div>
          <div className="topbar-actions">
            <span className="local-indicator">
              <span className="live-dot" />
              Ambiente local
            </span>
            <button
              className={`icon-button ${loading ? "spinning" : ""}`}
              aria-label="Atualizar dados"
              title="Atualizar dados"
              disabled={loading}
              onClick={() => void refresh()}
            >
              <RefreshCw size={18} />
            </button>
            <span className="avatar small">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <main className="main-content">
          {error && (
            <div className="alert error global-alert" role="alert">
              <XCircle size={18} />
              <span>{error}</span>
              <button aria-label="Fechar erro" onClick={() => setError("")}>
                <X size={17} />
              </button>
            </div>
          )}
          {success && (
            <div className="alert success global-alert" role="status">
              <CheckCircle2 size={18} />
              <span>{success}</span>
              <button
                aria-label="Fechar mensagem"
                onClick={() => setSuccess("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {page === "overview" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {isAdmin
                      ? "SUA OPERAÇÃO, EM TEMPO REAL"
                      : isCourier
                        ? "PRONTO PARA O PRÓXIMO DESTINO?"
                        : "SEU DIA, COM MAIS PRATICIDADE"}
                  </span>
                  <h1>
                    Olá, {user.name.split(" ")[0]}{" "}
                    <span className="greeting-dot">✦</span>
                  </h1>
                  <p>
                    {isAdmin
                      ? "Tudo o que você precisa para manter a cidade em movimento."
                      : isCourier
                        ? "Acompanhe seu turno e encontre sua próxima entrega."
                        : "Acompanhe seus pedidos. A gente cuida do caminho."}
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() =>
                    navigate(
                      isAdmin ? "deliveries" : isCourier ? "available" : "new",
                    )
                  }
                >
                  {isAdmin ? (
                    <Package size={18} />
                  ) : isCourier ? (
                    <Search size={18} />
                  ) : (
                    <Plus size={18} />
                  )}
                  {isAdmin
                    ? "Gerenciar entregas"
                    : isCourier
                      ? "Ver disponíveis"
                      : "Nova entrega"}
                </button>
              </div>
              <Overview
                user={user}
                data={data}
                myDeliveries={myDeliveries}
                navigate={navigate}
                detail={detail}
              />
            </>
          )}
          {page === "deliveries" && (
            <>
              <PageHeading
                title={pageTitles[page]}
                description={
                  isAdmin
                    ? "Cada pedido, cada etapa. Acompanhe toda a operação."
                    : "Veja o andamento e o histórico das suas entregas."
                }
                action={
                  !isAdmin && (
                    <button
                      className="button primary"
                      onClick={() => navigate("new")}
                    >
                      <Plus size={17} />
                      Nova entrega
                    </button>
                  )
                }
              />
              <DeliveryList
                deliveries={data.deliveries}
                user={user}
                courierId={data.profile?.id}
                detail={detail}
                loading={loading}
              />
            </>
          )}
          {page === "new" && (
            <>
              <PageHeading
                title="Vamos entregar?"
                description="Conte de onde sai, para onde vai e o que precisa chegar."
              />
              <NewDelivery
                busy={busy}
                onCreate={async (body) => {
                  setBusy(true);
                  setError("");
                  try {
                    const created = await api<Delivery>("/deliveries", {
                      method: "POST",
                      body,
                    });
                    await refresh(true);
                    setPage("deliveries");
                    setSuccess(
                      "Pedido criado! Estamos buscando um motoboy em serviço.",
                    );
                    setSelected(
                      await api<Delivery>(`/deliveries/${created.id}`),
                    );
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Não foi possível criar seu pedido.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          )}
          {page === "available" && (
            <>
              <PageHeading
                title="Seu próximo destino"
                description="Aceite uma entrega e siga em frente. Um pedido de cada vez."
                action={
                  <span className="count-label">
                    {data.available.length} disponíveis
                  </span>
                }
              />
              {!data.profile?.isAvailable ? (
                <div className="panel">
                  <Empty
                    icon={<Clock3 size={32} />}
                    title="Seu turno está fechado"
                  >
                    O administrador precisa abrir seu turno para você receber e
                    aceitar entregas.
                  </Empty>
                </div>
              ) : (
                <>
                  <div className="info-banner">
                    <Bike size={20} />
                    <span>
                      Você está em serviço.{" "}
                      {myDeliveries.some((delivery) =>
                        activeStatuses.includes(delivery.status),
                      )
                        ? "Conclua sua entrega atual para aceitar a próxima."
                        : "Escolha uma entrega e confirme o aceite."}
                    </span>
                  </div>
                  <div className="available-grid">
                    {data.available.map((delivery) => (
                      <article className="available-card" key={delivery.id}>
                        <div className="card-top">
                          <span className="order-id">
                            {shortId(delivery.id)}
                          </span>
                          <span className="delivery-price">
                            {money(delivery.totalAmount)}
                          </span>
                        </div>
                        <Route delivery={delivery} />
                        <div className="available-meta">
                          <span>
                            <Package size={15} />
                            {delivery.packageDescription || "Pacote"}
                          </span>
                          <span>
                            {Number(delivery.distanceKm).toLocaleString(
                              "pt-BR",
                            )}{" "}
                            km informados
                          </span>
                        </div>
                        <button
                          className="button primary full"
                          disabled={
                            busy ||
                            myDeliveries.some((item) =>
                              activeStatuses.includes(item.status),
                            )
                          }
                          onClick={() =>
                            confirmAction(
                              "Aceitar esta entrega? Você será responsável pela coleta e entrega deste pedido.",
                              () =>
                                mutate(
                                  `/deliveries/${delivery.id}/accept`,
                                  "PATCH",
                                  "Entrega aceita! Confira os detalhes para fazer a coleta.",
                                ),
                            )
                          }
                        >
                          <Check size={18} />
                          Aceitar entrega
                        </button>
                      </article>
                    ))}
                  </div>
                  {!data.available.length && (
                    <div className="panel">
                      <Empty title="Tudo em dia por aqui">
                        Novos pedidos aparecerão automaticamente quando forem
                        criados.
                      </Empty>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {page === "couriers" && isAdmin && (
            <>
              <PageHeading
                title="Quem faz acontecer"
                description="Aprove cadastros e acompanhe os motoboys da operação."
              />
              <Couriers
                couriers={data.couriers}
                busy={busy}
                approve={(courier) =>
                  confirmAction(
                    `Aprovar ${courier.user.name} como motoboy? O turno continuará fechado.`,
                    () =>
                      mutate(
                        `/admin/couriers/${courier.id}/approve`,
                        "PATCH",
                        "Motoboy aprovado. Agora você pode abrir o turno.",
                      ),
                  )
                }
                shift={(courier, open) =>
                  confirmAction(
                    open
                      ? `Abrir o turno de ${courier.user.name}?`
                      : `Fechar o turno de ${courier.user.name}? Entregas em andamento precisam ser concluídas antes.`,
                    () =>
                      mutate(
                        `/admin/couriers/${courier.id}/shifts/${open ? "open" : "close"}`,
                        "POST",
                        open
                          ? "Turno aberto. Motoboy disponível para entregas."
                          : "Turno encerrado e registrado no histórico.",
                      ),
                  )
                }
              />
            </>
          )}
          {page === "shifts" && isAdmin && (
            <>
              <PageHeading
                title="Histórico de turnos"
                description="Entrada, saída e responsáveis. Cada expediente registrado."
              />
              <ShiftTable shifts={data.shifts} />
            </>
          )}
          {page === "users" && isAdmin && (
            <>
              <PageHeading
                title="Pessoas da operação"
                description="Clientes, parceiros e administradores cadastrados."
              />
              <UsersTable users={data.users} />
            </>
          )}
          {page === "apply" && (
            <>
              <PageHeading
                title="Sua moto. Novos caminhos."
                description="Torne-se um parceiro EntregaJá e conecte a cidade."
              />
              <div className="application-layout">
                <div className="application-art">
                  <Bike size={70} strokeWidth={1.4} />
                  <span className="eyebrow">PARCEIROS ENTREGAJÁ</span>
                  <h2>
                    Faça parte
                    <br />
                    do movimento.
                  </h2>
                  <p>
                    Entregas locais, operação organizada e cada etapa na palma
                    da mão.
                  </p>
                </div>
                <div className="panel application-content">
                  {data.profile ? (
                    <>
                      <span className="soft-icon amber">
                        <Clock3 size={28} />
                      </span>
                      <h2>
                        {data.profile.isApproved
                          ? "Você já faz parte do time."
                          : "Sua solicitação está com a gente."}
                      </h2>
                      <p>
                        {data.profile.isApproved
                          ? "Atualize os dados para acessar seu painel de motoboy."
                          : "Seu cadastro está aguardando análise do administrador. Após a aprovação, seu perfil será atualizado automaticamente."}
                      </p>
                      <div className="info-line">
                        <Clock3 size={17} />
                        Solicitado em {date(data.profile.createdAt)}
                      </div>
                      <button
                        className="button secondary"
                        onClick={() => void refresh()}
                      >
                        <RefreshCw size={17} />
                        Verificar atualização
                      </button>
                    </>
                  ) : (
                    <>
                      <h2>Como funciona</h2>
                      <ol className="steps-list">
                        <li>
                          <span>1</span>
                          <div>
                            <b>Solicite seu cadastro</b>
                            <p>Seu perfil de cliente continua disponível.</p>
                          </div>
                        </li>
                        <li>
                          <span>2</span>
                          <div>
                            <b>Aguarde a aprovação</b>
                            <p>O administrador analisa sua solicitação.</p>
                          </div>
                        </li>
                        <li>
                          <span>3</span>
                          <div>
                            <b>Entre em serviço</b>
                            <p>Com o turno aberto, aceite entregas e comece.</p>
                          </div>
                        </li>
                      </ol>
                      <div className="info-banner">
                        <ShieldCheck size={20} />
                        <span>
                          Entregas feitas exclusivamente com motocicleta. A
                          abertura e o fechamento de turnos são feitos pelo
                          administrador.
                        </span>
                      </div>
                      <button
                        className="button primary full"
                        disabled={busy}
                        onClick={() =>
                          confirmAction(
                            "Solicitar cadastro como motoboy? Sua conta continuará como cliente até a aprovação do administrador.",
                            () =>
                              mutate(
                                "/couriers/apply",
                                "POST",
                                "Solicitação enviada! Aguarde a aprovação do administrador.",
                                {},
                              ),
                          )
                        }
                      >
                        <Bike size={18} />
                        Quero ser motoboy
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
          {page === "my-shift" && (
            <>
              <PageHeading
                title="Meu turno"
                description="Seu expediente, seus registros. Tudo em um lugar."
              />
              <div className="shift-state panel">
                <span
                  className={`soft-icon ${data.profile?.isAvailable ? "green" : "amber"}`}
                >
                  <Clock3 size={28} />
                </span>
                <div>
                  <h2>
                    {data.profile?.isAvailable
                      ? "Você está em serviço"
                      : "Seu turno está fechado"}
                  </h2>
                  <p>
                    {data.profile?.isAvailable
                      ? "Você pode aceitar pedidos disponíveis, um por vez."
                      : "Peça ao administrador para abrir seu próximo turno."}
                  </p>
                </div>
                {data.profile?.isAvailable && (
                  <button
                    className="button primary"
                    onClick={() => navigate("available")}
                  >
                    Ver entregas
                    <ArrowRight size={17} />
                  </button>
                )}
              </div>
              <ShiftTable shifts={data.profile?.shifts ?? []} own />
            </>
          )}
          <footer className="main-footer">
            <span>
              entregajá. <span>Conectando pedidos a destinos.</span>
            </span>
            <span>
              <span className="live-dot" />
              Atualização automática a cada 10 segundos
            </span>
          </footer>
        </main>
      </div>
      {selected && (
        <DeliveryDetail
          delivery={selected}
          user={user}
          profile={data.profile}
          couriers={data.couriers}
          busy={busy}
          error={error}
          close={() => !busy && setSelected(null)}
          onCancel={() =>
            confirmAction(
              "Cancelar esta entrega? Esta ação encerra o pedido e não pode ser desfeita.",
              () =>
                mutate(
                  `/deliveries/${selected.id}/cancel`,
                  "PATCH",
                  "Entrega cancelada.",
                ),
            )
          }
          onNext={() =>
            confirmAction(
              `${nextLabels[selected.status]}? Confirme somente após realizar esta etapa.`,
              () =>
                mutate(
                  `/deliveries/${selected.id}/status`,
                  "PATCH",
                  "Andamento da entrega atualizado.",
                  { status: nextStatus[selected.status] },
                ),
            )
          }
          onAssign={(courierId) =>
            mutate(
              `/deliveries/${selected.id}/assign`,
              "PATCH",
              "Motoboy atribuído à entrega.",
              { courierId },
            )
          }
        />
      )}
      {confirm && (
        <div
          className="modal-backdrop confirm-layer"
          onClick={() => !busy && setConfirm(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="confirm-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="soft-icon amber">
              <ShieldCheck size={25} />
            </span>
            <h2 id="confirm-title">Confirmar ação</h2>
            <p>{confirm.message}</p>
            <div className="modal-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                Voltar
              </button>
              <button
                className="button primary"
                autoFocus
                disabled={busy}
                onClick={() => void confirm.action()}
              >
                {busy ? "Aguarde…" : "Confirmar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">ENTREGAJÁ · MEU ESPAÇO</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function Overview({
  user,
  data,
  myDeliveries,
  navigate,
  detail,
}: {
  user: User;
  data: Data;
  myDeliveries: Delivery[];
  navigate: (page: Page) => void;
  detail: (delivery: Delivery) => Promise<void>;
}) {
  const admin = user.role === "ADMIN";
  const courier = user.role === "COURIER";
  const delivered = myDeliveries.filter(
    (delivery) => delivery.status === "DELIVERED",
  );
  const active = myDeliveries.filter(
    (delivery) => !terminalStatuses.includes(delivery.status),
  );
  const metrics = admin
    ? [
        {
          label: "Entregas no total",
          value: data.summary?.totalDeliveries ?? 0,
          icon: <Package size={21} />,
          tone: "orange",
          foot: "Todos os pedidos da operação",
        },
        {
          label: "Em andamento",
          value: data.summary?.activeDeliveries ?? 0,
          icon: <Truck size={21} />,
          tone: "blue",
          foot: "Do pedido até o destino",
        },
        {
          label: "Entregas concluídas",
          value: data.summary?.deliveredDeliveries ?? 0,
          icon: <CheckCheck size={21} />,
          tone: "green",
          foot: "Pedidos que chegaram lá",
        },
        {
          label: "Valor das concluídas",
          value: money(data.summary?.totalRevenue ?? 0),
          icon: <Wallet size={21} />,
          tone: "purple",
          foot: "Total dos pedidos entregues",
        },
      ]
    : [
        {
          label: courier ? "Minhas entregas" : "Pedidos realizados",
          value: myDeliveries.length,
          icon: <Package size={21} />,
          tone: "orange",
          foot: "Seu histórico na EntregaJá",
        },
        {
          label: "Em andamento",
          value: active.length,
          icon: <Truck size={21} />,
          tone: "blue",
          foot: "Acompanhe cada etapa",
        },
        {
          label: "Concluídas",
          value: delivered.length,
          icon: <CheckCheck size={21} />,
          tone: "green",
          foot: "Tudo certo no destino",
        },
        {
          label: courier ? "Situação do turno" : "Total em entregas",
          value: courier
            ? data.profile?.isAvailable
              ? "Em serviço"
              : "Fechado"
            : money(
                delivered.reduce(
                  (sum, delivery) => sum + Number(delivery.totalAmount),
                  0,
                ),
              ),
          icon: courier ? <Clock3 size={21} /> : <Wallet size={21} />,
          tone: "purple",
          foot: courier
            ? "Controlado pelo administrador"
            : "Somente pedidos concluídos",
        },
      ];
  return (
    <>
      <div className="metrics-grid">
        {metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <div className="metric-top">
              <span>{metric.label}</span>
              <span className={`metric-icon ${metric.tone}`}>
                {metric.icon}
              </span>
            </div>
            <strong
              className={
                typeof metric.value === "string" && metric.value.length > 10
                  ? "compact-value"
                  : ""
              }
            >
              {metric.value}
            </strong>
            <small>{metric.foot}</small>
          </div>
        ))}
      </div>
      <div className="overview-banner">
        <div>
          <span className="banner-kicker">
            <span className="live-dot" />
            {admin
              ? "DA SOLICITAÇÃO À ENTREGA"
              : courier
                ? "SEU TRABALHO MOVE A CIDADE"
                : "PRECISOU ENVIAR? DEIXA COM A GENTE."}
          </span>
          <h2>
            {admin
              ? "Uma operação que não para."
              : courier
                ? "Cada entrega abre um novo caminho."
                : "Seu próximo pedido, a poucos cliques."}
          </h2>
          <p>
            {admin
              ? "Acompanhe pedidos, conecte motoboys e mantenha tudo no caminho certo."
              : courier
                ? "Confira seu turno, aceite um pedido e acompanhe cada etapa até o destino."
                : "Informe os endereços, confira o valor e acompanhe o andamento."}
          </p>
          <button
            onClick={() =>
              navigate(admin ? "couriers" : courier ? "available" : "new")
            }
          >
            {admin
              ? "Gerenciar motoboys"
              : courier
                ? "Explorar entregas"
                : "Pedir uma entrega"}
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="banner-route" aria-hidden="true">
          <span className="route-node">
            <Package size={23} />
          </span>
          <i />
          <span className="route-node featured">
            <Bike size={35} />
          </span>
          <i />
          <span className="route-node">
            <MapPin size={24} />
          </span>
          <b>DO PEDIDO AO DESTINO</b>
        </div>
      </div>
      {admin && Boolean(data.summary?.pendingCouriers) && (
        <button className="pending-banner" onClick={() => navigate("couriers")}>
          <span className="soft-icon amber">
            <UserRound size={21} />
          </span>
          <span>
            <b>
              {data.summary!.pendingCouriers} cadastro
              {data.summary!.pendingCouriers > 1 ? "s" : ""} aguardando
              aprovação
            </b>
            <small>Novos parceiros prontos para fazer parte da operação.</small>
          </span>
          <ArrowRight size={19} />
        </button>
      )}
      <div className="overview-columns">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>
                {admin
                  ? "Últimas entregas"
                  : courier
                    ? "Seu movimento recente"
                    : "Seus últimos pedidos"}
              </h2>
              <p>Atualizações que importam para você.</p>
            </div>
            <button
              className="text-button"
              onClick={() => navigate("deliveries")}
            >
              Ver todas
              <ArrowRight size={15} />
            </button>
          </div>
          <DeliveryRows
            deliveries={(admin ? data.deliveries : myDeliveries).slice(0, 5)}
            detail={detail}
            compact
          />
        </section>
        <aside className="panel operation-panel">
          <span className="eyebrow">
            {admin ? "PULSO DA OPERAÇÃO" : "SEMPRE BOM SABER"}
          </span>
          <h2>{admin ? "No ritmo certo." : "Cada etapa, mais perto."}</h2>
          {admin ? (
            <>
              <div className="pulse-stat">
                <span className="soft-icon green">
                  <Bike size={20} />
                </span>
                <div>
                  <strong>{data.summary?.availableCouriers ?? 0}</strong>
                  <span>motoboys em serviço</span>
                </div>
                <span className="live-dot" />
              </div>
              <div className="pulse-stat">
                <span className="soft-icon amber">
                  <Clock3 size={20} />
                </span>
                <div>
                  <strong>{data.summary?.pendingCouriers ?? 0}</strong>
                  <span>cadastros pendentes</span>
                </div>
              </div>
              <div className="pulse-stat">
                <span className="soft-icon gray">
                  <XCircle size={20} />
                </span>
                <div>
                  <strong>{data.summary?.cancelledDeliveries ?? 0}</strong>
                  <span>pedidos cancelados</span>
                </div>
              </div>
              <button
                className="button secondary full"
                onClick={() => navigate("shifts")}
              >
                Consultar turnos
                <ArrowUpRight size={16} />
              </button>
            </>
          ) : (
            <>
              <div className="tip-row">
                <span>
                  <Package size={19} />
                </span>
                <div>
                  <b>Pedido confirmado</b>
                  <p>Os detalhes chegam à operação.</p>
                </div>
              </div>
              <div className="tip-row">
                <span>
                  <Bike size={20} />
                </span>
                <div>
                  <b>Motoboy conectado</b>
                  <p>Coleta e trajeto registrados.</p>
                </div>
              </div>
              <div className="tip-row">
                <span>
                  <CheckCheck size={20} />
                </span>
                <div>
                  <b>Entrega concluída</b>
                  <p>Seu histórico sempre à mão.</p>
                </div>
              </div>
              <div className="small-note">
                Os valores são calculados pela distância informada. O
                acompanhamento mostra etapas; não utiliza GPS.
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function Route({ delivery }: { delivery: Delivery }) {
  return (
    <div className="delivery-route">
      <div className="route-line">
        <span className="pickup-dot" />
        <i />
        <MapPin size={15} />
      </div>
      <div className="route-addresses">
        <div>
          <small>COLETA</small>
          <p>{delivery.pickupAddress}</p>
        </div>
        <div>
          <small>ENTREGA</small>
          <p>{delivery.dropoffAddress}</p>
        </div>
      </div>
    </div>
  );
}

function DeliveryRows({
  deliveries,
  detail,
  compact = false,
}: {
  deliveries: Delivery[];
  detail: (delivery: Delivery) => Promise<void>;
  compact?: boolean;
}) {
  if (!deliveries.length)
    return (
      <Empty title="Nenhuma entrega encontrada">
        Crie um pedido ou ajuste os filtros para ver as entregas.
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table
        className={`data-table delivery-table ${compact ? "compact-table" : ""}`}
      >
        <thead>
          <tr>
            <th>Pedido / destino</th>
            <th>Status</th>
            <th>Valor</th>
            {!compact && <th>Motoboy</th>}
            <th aria-label="Ver detalhes" />
          </tr>
        </thead>
        <tbody>
          {deliveries.map((delivery) => (
            <tr key={delivery.id} onClick={() => void detail(delivery)}>
              <td>
                <button
                  className="order-cell"
                  onClick={(event) => {
                    event.stopPropagation();
                    void detail(delivery);
                  }}
                >
                  <span className="package-tile">
                    <Package size={19} />
                  </span>
                  <span>
                    <b>{shortId(delivery.id)}</b>
                    <small>{delivery.dropoffAddress}</small>
                    <em>{date(delivery.createdAt)}</em>
                  </span>
                </button>
              </td>
              <td>
                <Badge status={delivery.status} />
              </td>
              <td className="money-cell">{money(delivery.totalAmount)}</td>
              {!compact && (
                <td>
                  {delivery.courier?.user.name ?? (
                    <span className="muted">Aguardando</span>
                  )}
                </td>
              )}
              <td>
                <button
                  className="icon-button"
                  title={`Detalhes do pedido ${shortId(delivery.id)}`}
                  aria-label={`Detalhes do pedido ${shortId(delivery.id)}`}
                >
                  <ChevronRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliveryList({
  deliveries,
  user,
  courierId,
  detail,
  loading,
}: {
  deliveries: Delivery[];
  user: User;
  courierId?: string;
  detail: (delivery: Delivery) => Promise<void>;
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [scope, setScope] = useState("courier");
  const base =
    user.role === "COURIER"
      ? deliveries.filter((delivery) =>
          scope === "courier"
            ? delivery.courierId === courierId
            : delivery.customer?.user.id === user.id,
        )
      : deliveries;
  const rows = base.filter((delivery) => {
    const haystack =
      `${delivery.id} ${delivery.pickupAddress} ${delivery.dropoffAddress} ${delivery.recipientName ?? ""} ${delivery.courier?.user.name ?? ""}`.toLowerCase();
    return (
      haystack.includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "active" && !terminalStatuses.includes(delivery.status)) ||
        delivery.status === filter)
    );
  });
  return (
    <section className="panel">
      <div className="table-toolbar">
        <div className="filter-tabs">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Todas <span>{base.length}</span>
          </button>
          <button
            className={filter === "active" ? "active" : ""}
            onClick={() => setFilter("active")}
          >
            Em andamento
          </button>
          <button
            className={filter === "DELIVERED" ? "active" : ""}
            onClick={() => setFilter("DELIVERED")}
          >
            Concluídas
          </button>
          <button
            className={filter === "CANCELLED" ? "active" : ""}
            onClick={() => setFilter("CANCELLED")}
          >
            Canceladas
          </button>
        </div>
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="Buscar entregas"
            placeholder="Buscar pedido ou endereço"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {user.role === "COURIER" && (
        <div className="scope-toolbar">
          <label>
            Exibir{" "}
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              <option value="courier">Entregas como motoboy</option>
              <option value="customer">Pedidos que eu fiz</option>
            </select>
          </label>
        </div>
      )}
      {loading && !rows.length ? (
        <div className="loading-state">
          <div className="spinner" />
          Carregando entregas…
        </div>
      ) : (
        <DeliveryRows deliveries={rows} detail={detail} />
      )}
      <div className="table-foot">
        {rows.length} entrega{rows.length !== 1 ? "s" : ""} encontrada
        {rows.length !== 1 ? "s" : ""}
        <span>Até 200 pedidos mais recentes</span>
      </div>
    </section>
  );
}

function NewDelivery({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (body: unknown) => Promise<void>;
}) {
  const [form, setForm] = useState({
    pickupAddress: "",
    dropoffAddress: "",
    pickupReference: "",
    dropoffReference: "",
    recipientName: "",
    recipientPhone: "",
    packageDescription: "",
    distanceKm: "3",
  });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoteBusy, setQuoteBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setQuote(null);
    setQuoteError("");
    const km = Number(form.distanceKm);
    if (km < 0.1 || km > 200 || !Number.isFinite(km)) {
      setQuoteBusy(false);
      return;
    }
    setQuoteBusy(true);
    const timeout = setTimeout(() => {
      void api<Quote>("/deliveries/quote", {
        method: "POST",
        body: { distanceKm: km },
      })
        .then((value) => {
          if (!cancelled) setQuote(value);
        })
        .catch((error) => {
          if (!cancelled)
            setQuoteError(
              error instanceof Error
                ? error.message
                : "Não foi possível calcular o valor.",
            );
        })
        .finally(() => {
          if (!cancelled) setQuoteBusy(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [form.distanceKm]);
  const input = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      const value = event.target.value;
      if (key === "recipientPhone") {
        const digits = value.replace(/\D/g, "");
        event.currentTarget.setCustomValidity(
          digits.length >= 10 && digits.length <= 13
            ? ""
            : "Informe um telefone com DDD, entre 10 e 13 dígitos.",
        );
      }
      setForm((previous) => ({ ...previous, [key]: value }));
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!quote) return;
    void onCreate({
      ...form,
      distanceKm: Number(form.distanceKm),
      pickupReference: form.pickupReference || undefined,
      dropoffReference: form.dropoffReference || undefined,
    });
  }
  return (
    <form onSubmit={submit} className="new-delivery-layout">
      <div className="form-stack">
        <section className="panel form-panel">
          <div className="form-section-title">
            <span className="step-circle">01</span>
            <div>
              <h2>O caminho</h2>
              <p>Informe os endereços completos, com número e bairro.</p>
            </div>
          </div>
          <Field label="Endereço de coleta">
            <input
              required
              minLength={5}
              maxLength={200}
              placeholder="Rua, número, bairro e cidade"
              {...input("pickupAddress")}
            />
          </Field>
          <Field label="Referência da coleta (opcional)">
            <input
              maxLength={200}
              placeholder="Ex.: portaria, próximo à praça…"
              {...input("pickupReference")}
            />
          </Field>
          <div className="form-divider" />
          <Field label="Endereço de entrega">
            <input
              required
              minLength={5}
              maxLength={200}
              placeholder="Rua, número, bairro e cidade"
              {...input("dropoffAddress")}
            />
          </Field>
          <Field label="Referência da entrega (opcional)">
            <input
              maxLength={200}
              placeholder="Ajude o motoboy a encontrar o destino"
              {...input("dropoffReference")}
            />
          </Field>
          <Field
            label="Distância estimada do trajeto (km)"
            hint="Informe a distância do percurso. Não há cálculo de rota por mapa nesta versão."
          >
            <input
              required
              type="number"
              min="0.1"
              max="200"
              step="0.1"
              {...input("distanceKm")}
            />
          </Field>
        </section>
        <section className="panel form-panel">
          <div className="form-section-title">
            <span className="step-circle">02</span>
            <div>
              <h2>Quem recebe e o que vai</h2>
              <p>As informações certas fazem toda a diferença.</p>
            </div>
          </div>
          <div className="form-two-columns">
            <Field label="Nome de quem recebe">
              <input
                required
                minLength={2}
                maxLength={100}
                placeholder="Nome do destinatário"
                {...input("recipientName")}
              />
            </Field>
            <Field label="Telefone do destinatário">
              <input
                required
                type="tel"
                minLength={10}
                maxLength={25}
                placeholder="(85) 99999-9999"
                {...input("recipientPhone")}
              />
            </Field>
          </div>
          <Field
            label="O que será entregue?"
            hint="Descreva o pacote e instruções de manuseio."
          >
            <textarea
              required
              minLength={3}
              maxLength={500}
              rows={3}
              placeholder="Ex.: documento em envelope, retirar na recepção."
              {...input("packageDescription")}
            />
          </Field>
        </section>
      </div>
      <aside className="order-summary panel">
        <span className="eyebrow">SEU PEDIDO</span>
        <h2>Quase no caminho.</h2>
        <div className="summary-art">
          <Package size={58} strokeWidth={1.3} />
          <span>
            <Bike size={26} />
          </span>
        </div>
        <div className="summary-line">
          <span>Modalidade</span>
          <b>Motocicleta</b>
        </div>
        <div className="summary-line">
          <span>Distância informada</span>
          <b>{form.distanceKm || "—"} km</b>
        </div>
        <div className="summary-total">
          <span>Valor da entrega</span>
          <strong>
            {quoteBusy ? "Calculando…" : quote ? money(quote.totalAmount) : "—"}
          </strong>
        </div>
        {quoteError && <div className="alert error">{quoteError}</div>}
        <div className="small-note">
          <CreditCard size={17} />
          <span>
            O valor é calculado pelo servidor. O pagamento deve ser combinado
            com a operação, fora do sistema.
          </span>
        </div>
        <button
          type="submit"
          className="button primary full"
          disabled={busy || !quote || quoteBusy}
        >
          {busy ? "Criando pedido…" : "Confirmar pedido"}
          <ArrowRight size={18} />
        </button>
        <small className="summary-disclaimer">
          Após confirmar, um motoboy em serviço poderá aceitar sua entrega.
        </small>
      </aside>
    </form>
  );
}

function Couriers({
  couriers,
  busy,
  approve,
  shift,
}: {
  couriers: Courier[];
  busy: boolean;
  approve: (courier: Courier) => void;
  shift: (courier: Courier, open: boolean) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const rows = couriers.filter(
    (courier) =>
      (filter === "all" ||
        (filter === "pending" && !courier.isApproved) ||
        (filter === "active" && courier.isAvailable)) &&
      `${courier.user.name} ${courier.user.email}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className="panel">
      <div className="table-toolbar">
        <div className="filter-tabs">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Todos<span>{couriers.length}</span>
          </button>
          <button
            className={filter === "pending" ? "active" : ""}
            onClick={() => setFilter("pending")}
          >
            Aguardando aprovação
          </button>
          <button
            className={filter === "active" ? "active" : ""}
            onClick={() => setFilter("active")}
          >
            Em serviço
          </button>
        </div>
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="Buscar motoboy"
            placeholder="Buscar motoboy"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {!rows.length ? (
        <Empty icon={<Bike size={30} />} title="Nenhum motoboy encontrado">
          As solicitações de cadastro aparecerão aqui para aprovação.
        </Empty>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Motoboy</th>
                <th>Cadastro</th>
                <th>Expediente</th>
                <th>Em andamento</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((courier) => (
                <tr key={courier.id}>
                  <td>
                    <div className="person-cell">
                      <span className="avatar">
                        {courier.user.name.slice(0, 1)}
                      </span>
                      <span>
                        <b>{courier.user.name}</b>
                        <small>{courier.user.email}</small>
                        {courier.user.phone && (
                          <small>{courier.user.phone}</small>
                        )}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${courier.isApproved ? "status-delivered" : "status-searching"}`}
                    >
                      <span className="badge-dot" />
                      {courier.isApproved ? "Aprovado" : "Pendente"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`inline-state ${courier.isAvailable ? "online" : ""}`}
                    >
                      <span />
                      {courier.isAvailable ? "Em serviço" : "Fora de serviço"}
                    </span>
                  </td>
                  <td>
                    {courier.activeDeliveries ?? 0} entrega
                    {courier.activeDeliveries === 1 ? "" : "s"}
                  </td>
                  <td>
                    {!courier.isApproved ? (
                      <button
                        className="button primary small-button"
                        disabled={busy}
                        onClick={() => approve(courier)}
                      >
                        <Check size={15} />
                        Aprovar
                      </button>
                    ) : (
                      <button
                        className={`button small-button ${courier.isAvailable ? "secondary" : "primary"}`}
                        disabled={
                          busy ||
                          Boolean(
                            courier.isAvailable && courier.activeDeliveries,
                          )
                        }
                        title={
                          courier.isAvailable && courier.activeDeliveries
                            ? "Conclua as entregas antes de fechar o turno"
                            : undefined
                        }
                        onClick={() => shift(courier, !courier.isAvailable)}
                      >
                        <Clock3 size={15} />
                        {courier.isAvailable ? "Fechar turno" : "Abrir turno"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-foot">
        {rows.length} parceiro{rows.length !== 1 ? "s" : ""} encontrado
        {rows.length !== 1 ? "s" : ""}
        <span>Disponibilidade controlada por turnos</span>
      </div>
    </section>
  );
}

function ShiftTable({
  shifts,
  own = false,
}: {
  shifts: Shift[];
  own?: boolean;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{own ? "Meus expedientes" : "Registro de expedientes"}</h2>
          <p>Aberturas e encerramentos realizados pela administração.</p>
        </div>
        <span className="count-label">{shifts.length} registros</span>
      </div>
      {!shifts.length ? (
        <Empty icon={<Clock3 size={30} />} title="Nenhum turno registrado">
          Os expedientes aparecerão aqui assim que forem abertos.
        </Empty>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {!own && <th>Motoboy</th>}
                <th>Abertura</th>
                <th>Encerramento</th>
                <th>Situação</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id}>
                  {!own && (
                    <td>
                      <b>{shift.courier?.user.name ?? "Motoboy"}</b>
                    </td>
                  )}
                  <td>{date(shift.openedAt)}</td>
                  <td>
                    {shift.closedAt ? (
                      date(shift.closedAt)
                    ) : (
                      <span className="muted">Em andamento</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${shift.closedAt ? "status-cancelled" : "status-delivered"}`}
                    >
                      <span className="badge-dot" />
                      {shift.closedAt ? "Encerrado" : "Aberto"}
                    </span>
                  </td>
                  <td>
                    <div className="stacked-cell">
                      <span>
                        Entrada: {shift.openedBy?.name ?? "Administrador"}
                      </span>
                      {shift.closedBy && (
                        <small>Saída: {shift.closedBy.name}</small>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function UsersTable({ users }: { users: User[] }) {
  const [search, setSearch] = useState("");
  const rows = users.filter((user) =>
    `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel">
      <div className="table-toolbar">
        <span className="count-label">{users.length} pessoas cadastradas</span>
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="Buscar usuário"
            placeholder="Buscar nome ou e-mail"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {!rows.length ? (
        <Empty title="Nenhum usuário encontrado" />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Telefone</th>
                <th>Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="person-cell">
                      <span className="avatar">{user.name.slice(0, 1)}</span>
                      <span>
                        <b>{user.name}</b>
                        <small>{user.email}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="role-label">{roleNames[user.role]}</span>
                  </td>
                  <td>{user.phone || "—"}</td>
                  <td>{user.createdAt ? date(user.createdAt, false) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DeliveryDetail({
  delivery,
  user,
  profile,
  couriers,
  busy,
  error,
  close,
  onCancel,
  onNext,
  onAssign,
}: {
  delivery: Delivery;
  user: User;
  profile: Courier | null;
  couriers: Courier[];
  busy: boolean;
  error: string;
  close: () => void;
  onCancel: () => void;
  onNext: () => void;
  onAssign: (id: string) => Promise<void>;
}) {
  const [courierId, setCourierId] = useState("");
  const admin = user.role === "ADMIN";
  const owner = delivery.customer?.user.id === user.id;
  const assigned = delivery.courierId === profile?.id;
  const canCancel =
    (admin || owner) &&
    ["PENDING", "SEARCHING", "ASSIGNED"].includes(delivery.status);
  const canAdvance =
    (admin || assigned) && Boolean(nextStatus[delivery.status]);
  const eligible = couriers.filter(
    (courier) =>
      courier.isApproved &&
      courier.isAvailable &&
      !courier.activeDeliveries &&
      courier.userId !== delivery.customer?.user.id,
  );
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-detail-title"
        className="detail-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="detail-header">
          <div>
            <span className="eyebrow">DETALHES DA ENTREGA</span>
            <h2 id="delivery-detail-title">Pedido {shortId(delivery.id)}</h2>
            <span className="muted">Criado em {date(delivery.createdAt)}</span>
          </div>
          <button
            className="icon-button"
            aria-label="Fechar detalhes"
            autoFocus
            onClick={close}
          >
            <X size={22} />
          </button>
        </header>
        <div className="detail-body">
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <div className="detail-status-row">
            <Badge status={delivery.status} />
            <strong>{money(delivery.totalAmount)}</strong>
          </div>
          <Route delivery={delivery} />
          {(delivery.pickupReference || delivery.dropoffReference) && (
            <div className="reference-box">
              {delivery.pickupReference && (
                <p>
                  <b>Referência da coleta:</b> {delivery.pickupReference}
                </p>
              )}
              {delivery.dropoffReference && (
                <p>
                  <b>Referência da entrega:</b> {delivery.dropoffReference}
                </p>
              )}
            </div>
          )}
          <div className="detail-info-grid">
            <div>
              <span>Destinatário</span>
              <b>{delivery.recipientName || "Não informado"}</b>
              <small>
                {delivery.recipientPhone || "Telefone não informado"}
              </small>
            </div>
            <div>
              <span>Motoboy</span>
              <b>{delivery.courier?.user.name ?? "Aguardando aceite"}</b>
              {delivery.courier?.user.phone && (
                <small>{delivery.courier.user.phone}</small>
              )}
            </div>
            <div>
              <span>Pacote</span>
              <b>{delivery.packageDescription || "Não informado"}</b>
            </div>
            <div>
              <span>Distância informada</span>
              <b>{Number(delivery.distanceKm).toLocaleString("pt-BR")} km</b>
            </div>
            {admin && delivery.customer && (
              <div>
                <span>Cliente</span>
                <b>{delivery.customer.user.name}</b>
                <small>{delivery.customer.user.email}</small>
              </div>
            )}
          </div>
          {admin && ["PENDING", "SEARCHING"].includes(delivery.status) && (
            <div className="assign-box">
              <label className="field">
                <span>Atribuir motoboy em serviço</span>
                <select
                  value={courierId}
                  onChange={(event) => setCourierId(event.target.value)}
                >
                  <option value="">
                    {eligible.length
                      ? "Selecione um motoboy disponível"
                      : "Nenhum motoboy livre em serviço"}
                  </option>
                  {eligible.map((courier) => (
                    <option key={courier.id} value={courier.id}>
                      {courier.user.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button secondary"
                disabled={!courierId || busy}
                onClick={() => void onAssign(courierId)}
              >
                <Bike size={17} />
                Atribuir
              </button>
            </div>
          )}
          <div className="timeline-heading">
            <h3>O caminho até aqui</h3>
            <span>Atualizações de status</span>
          </div>
          <ol className="timeline">
            {(delivery.events?.length
              ? delivery.events
              : [
                  {
                    id: "current",
                    status: delivery.status,
                    createdAt: delivery.updatedAt,
                    note: null,
                  },
                ]
            ).map((event, index, events) => (
              <li
                key={event.id}
                className={index === events.length - 1 ? "current" : ""}
              >
                <span className="timeline-dot">
                  {index === events.length - 1 ? (
                    <Circle size={9} fill="currentColor" />
                  ) : (
                    <Check size={12} />
                  )}
                </span>
                <div>
                  <b>{statusNames[event.status]}</b>
                  {event.note && <p>{event.note}</p>}
                  <small>{date(event.createdAt)}</small>
                </div>
              </li>
            ))}
          </ol>
          <div className="small-note">
            <Wallet size={17} />
            <span>
              Valor registrado no pedido. Pagamento combinado diretamente com a
              operação.
            </span>
          </div>
        </div>
        <footer className="detail-actions">
          {canCancel && (
            <button
              className="button danger"
              disabled={busy}
              onClick={onCancel}
            >
              Cancelar entrega
            </button>
          )}
          <div />
          {canAdvance && (
            <button className="button primary" disabled={busy} onClick={onNext}>
              {nextLabels[delivery.status]}
              <ArrowRight size={17} />
            </button>
          )}
          {!canAdvance && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={close}
            >
              Fechar
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
