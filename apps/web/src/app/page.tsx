"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type User = {
  id: string;
  email: string;
};

type AuthTokens = {
  userId: string;
  accessToken: string;
};

type Raffle = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  totalTickets: number;
  ticketsSold: number;
  ticketPrice: number;
  endTime: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeOptionalText = (value: string) => value.trim() || undefined;
const getLocalDateTimeInputMinimum = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      return data.message.join(", ");
    }

    return data.message ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
};

export default function Home() {
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ticketPrice, setTicketPrice] = useState(100);
  const [totalTickets, setTotalTickets] = useState(10);
  const [endTime, setEndTime] = useState("");
  const [ticketPurchaseCounts, setTicketPurchaseCounts] = useState<
    Record<string, number>
  >({});

  const authorizationHeader = useMemo(
    () =>
      tokens?.accessToken
        ? { Authorization: "Bearer " + tokens.accessToken }
        : undefined,
    [tokens],
  );
  const minimumEndTime = useMemo(() => getLocalDateTimeInputMinimum(), []);

  const loadRaffles = async () => {
    const response = await fetch(`${API_BASE}/raffles`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    const data = (await response.json()) as Raffle[];
    setRaffles(data);
  };

  useEffect(() => {
    let cancelled = false;

    const fetchInitialRaffles = async () => {
      try {
        await loadRaffles();
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to load raffles";
        if (!cancelled) {
          setStatusMessage(message);
        }
      }
    };

    void fetchInitialRaffles();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const response = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizeEmail(signupEmail),
        password: signupPassword,
      }),
    });

    if (!response.ok) {
      setStatusMessage(await parseErrorMessage(response));
      return;
    }

    const user = (await response.json()) as User;
    setCurrentUserId(user.id);
    setSessionEmail(normalizeEmail(user.email));
    setStatusMessage(`Signed up ${user.email}. Now log in.`);
    setSignupEmail("");
    setSignupPassword("");
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizeEmail(loginEmail),
        password: loginPassword,
      }),
    });

    if (!response.ok) {
      setStatusMessage(await parseErrorMessage(response));
      return;
    }

    const tokenPair = (await response.json()) as AuthTokens;
    setTokens(tokenPair);
    setSessionEmail(normalizeEmail(loginEmail));
    setCurrentUserId(tokenPair.userId);
    setStatusMessage("Logged in.");
    setLoginPassword("");
  };

  const handleCreateRaffle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authorizationHeader || !currentUserId) {
      setStatusMessage("Log in before creating a raffle.");
      return;
    }

    const response = await fetch(`${API_BASE}/raffles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authorizationHeader,
      },
      body: JSON.stringify({
        rafflerId: currentUserId,
        title,
        description: normalizeOptionalText(description),
        totalTickets: Number(totalTickets),
        ticketPrice: Number(ticketPrice),
        status: "ACTIVE",
        endTime: new Date(endTime).toISOString(),
      }),
    });

    if (!response.ok) {
      setStatusMessage(await parseErrorMessage(response));
      return;
    }

    setStatusMessage("Raffle created.");
    setTitle("");
    setDescription("");
    await loadRaffles();
  };

  const handlePurchase = async (raffleId: string) => {
    if (!authorizationHeader || !currentUserId) {
      setStatusMessage("Log in before purchasing tickets.");
      return;
    }

    const quantity = ticketPurchaseCounts[raffleId] ?? 1;
    const response = await fetch(`${API_BASE}/raffles/${raffleId}/purchase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authorizationHeader,
      },
      body: JSON.stringify({
        buyerId: currentUserId,
        quantity,
      }),
    });

    if (!response.ok) {
      setStatusMessage(await parseErrorMessage(response));
      return;
    }

    setStatusMessage(`Purchased ${quantity} ticket${quantity === 1 ? "" : "s"}.`);
    await loadRaffles();
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Raffle Royale MVP</h1>
          <p>Prototype flow: sign up, log in, list raffles, and buy tickets.</p>
          <p className={styles.status}>{statusMessage}</p>
        </header>

        <section className={styles.grid}>
          <form className={styles.card} onSubmit={handleSignup}>
            <h2>1) Sign up</h2>
            <input
              type="email"
              required
              placeholder="Email"
              value={signupEmail}
              onChange={(event) => setSignupEmail(event.target.value)}
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Password (8+ chars)"
              value={signupPassword}
              onChange={(event) => setSignupPassword(event.target.value)}
            />
            <button type="submit">Create account</button>
          </form>

          <form className={styles.card} onSubmit={handleLogin}>
            <h2>2) Log in</h2>
            <input
              type="email"
              required
              placeholder="Email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
            />
            <button type="submit">Log in</button>
            {sessionEmail ? (
              <p className={styles.inlineMeta}>
                Signed in as {sessionEmail}
              </p>
            ) : null}
          </form>

          <form className={styles.cardWide} onSubmit={handleCreateRaffle}>
            <h2>3) List a raffle</h2>
            <input
              type="text"
              required
              placeholder="Raffle title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <textarea
              placeholder="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className={styles.inlineFields}>
              <label>
                Ticket price (cents)
                <input
                  type="number"
                  min={1}
                  required
                  value={ticketPrice}
                  onChange={(event) => setTicketPrice(Number(event.target.value))}
                />
              </label>
              <label>
                Total tickets
                <input
                  type="number"
                  min={1}
                  required
                  value={totalTickets}
                  onChange={(event) => setTotalTickets(Number(event.target.value))}
                />
              </label>
            </div>
            <label>
              End time
              <input
                type="datetime-local"
                required
                value={endTime}
                min={minimumEndTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </label>
            <button type="submit">Create active raffle</button>
          </form>
        </section>

        <section className={styles.rafflesSection}>
          <h2>4) Browse & purchase tickets</h2>
          {raffles.length === 0 ? <p>No raffles yet.</p> : null}
          <ul className={styles.rafflesList}>
            {raffles.map((raffle) => {
              const quantity = ticketPurchaseCounts[raffle.id] ?? 1;
              const remaining = raffle.totalTickets - raffle.ticketsSold;
              const canPurchase = raffle.status === "ACTIVE" && remaining > 0;

              return (
                <li key={raffle.id} className={styles.raffleCard}>
                  <h3>{raffle.title}</h3>
                  <p>{raffle.description ?? "No description."}</p>
                  <p>
                    Status: <strong>{raffle.status}</strong>
                  </p>
                  <p>
                    Sold: {raffle.ticketsSold}/{raffle.totalTickets} · Remaining:{" "}
                    {remaining}
                  </p>
                  <p>Price: {raffle.ticketPrice} cents</p>
                  <p>Ends: {new Date(raffle.endTime).toLocaleString()}</p>
                  <div className={styles.purchaseRow}>
                    <input
                      type="number"
                      min={1}
                      max={canPurchase ? remaining : 1}
                      value={quantity}
                      disabled={!canPurchase}
                      onChange={(event) =>
                        setTicketPurchaseCounts((previous) => ({
                          ...previous,
                          [raffle.id]: Number(event.target.value),
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handlePurchase(raffle.id);
                      }}
                      disabled={!canPurchase}
                    >
                      Buy tickets
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
