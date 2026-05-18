import { FormEvent, useState } from "react";
import { api } from "../api.js";

export function TeamPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.createClientUser({ email, name, password });
      setMessage(`Usuário ${email} criado com acesso de cliente.`);
      setEmail("");
      setName("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Equipe</h1>
      <p style={{ color: "var(--muted)" }}>
        Crie login para o cliente gerenciar agenda e agente.
      </p>

      {message && <p style={{ color: "#6bcf8e" }}>{message}</p>}
      {error && <p className="error">{error}</p>}

      <form onSubmit={onSubmit} className="card">
        <h2>Novo usuário cliente</h2>
        <label>Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
        <label>E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label>Senha inicial</label>
        <input
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary">
          Criar usuário
        </button>
      </form>
    </>
  );
}
