const FUNCTION_URL = "https://ngjuarfnlepwmvzmkukw.supabase.co/functions/v1/ouvidoria-link";

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR");
}

function getToken() {
  const url = new URL(window.location.href);
  return String(url.searchParams.get("token") || "").trim();
}

function setFlash(kind, message) {
  const flash = byId("flash");
  flash.innerHTML = message
    ? `<div class="${kind === "ok" ? "flash-ok" : "flash-err"}">${escapeHtml(message)}</div>`
    : "";
}

function renderContext(ctx) {
  const report = ctx?.report || {};
  byId("meta").innerHTML = `
    <div><strong>ID:</strong> ${escapeHtml(report.id || "-")}</div>
    <div><strong>Categoria:</strong> ${escapeHtml(report.category_label || "Publicacao")}</div>
    <div><strong>Local:</strong> ${escapeHtml(report.address_text || report.city || "Nao informado")}</div>
    <div><strong>Status atual:</strong> ${escapeHtml(report.status || "pendente")}</div>
  `;

  const rows = Array.isArray(ctx?.chatRows) ? ctx.chatRows : [];
  if (!rows.length) {
    byId("chatList").innerHTML = `<div class="meta">Sem mensagens ainda.</div>`;
    return;
  }

  byId("chatList").innerHTML = rows
    .map((item) => {
      const role = item?.sender_role === "ombudsman" ? "ombudsman" : "citizen";
      const sender = role === "ombudsman"
        ? item?.sender_display || "Ouvidoria"
        : "Cidadao";
      return `
        <div class="msg ${role}">
          <div class="sender">${escapeHtml(sender)}</div>
          <div class="body">${escapeHtml(item?.message || "")}</div>
          <div class="time">${escapeHtml(formatDate(item?.created_at))}</div>
        </div>
      `;
    })
    .join("");
}

async function fetchContext(token) {
  const resp = await fetch(`${FUNCTION_URL}?token=${encodeURIComponent(token)}&format=json`);
  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok || !payload?.ok) {
    throw new Error(payload?.error || "Nao foi possivel carregar o painel.");
  }
  return payload;
}

async function postAction(body) {
  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok || payload?.error) {
    throw new Error(payload?.error || "Falha ao processar acao.");
  }
  return payload;
}

async function bootstrap() {
  const token = getToken();
  if (!token) {
    setFlash("err", "Link invalido: token ausente.");
    byId("markBtn").disabled = true;
    byId("sendBtn").disabled = true;
    return;
  }

  async function reload() {
    const ctx = await fetchContext(token);
    renderContext(ctx);
  }

  byId("markBtn").addEventListener("click", async () => {
    try {
      byId("markBtn").disabled = true;
      setFlash("", "");
      await postAction({ token, action: "mark_in_analysis" });
      await reload();
      setFlash("ok", "Status atualizado para Em analise.");
    } catch (error) {
      setFlash("err", String(error?.message || error || "Falha ao atualizar status."));
    } finally {
      byId("markBtn").disabled = false;
    }
  });

  byId("sendBtn").addEventListener("click", async () => {
    const message = String(byId("message").value || "").trim();
    const senderDisplay = String(byId("senderDisplay").value || "").trim();
    if (!message) {
      setFlash("err", "Informe uma mensagem.");
      return;
    }
    try {
      byId("sendBtn").disabled = true;
      setFlash("", "");
      await postAction({
        token,
        action: "send_message",
        message,
        senderDisplay,
      });
      byId("message").value = "";
      await reload();
      setFlash("ok", "Mensagem enviada com sucesso.");
    } catch (error) {
      setFlash("err", String(error?.message || error || "Falha ao enviar mensagem."));
    } finally {
      byId("sendBtn").disabled = false;
    }
  });

  try {
    await reload();
  } catch (error) {
    setFlash("err", String(error?.message || error || "Falha ao carregar dados."));
    byId("markBtn").disabled = true;
    byId("sendBtn").disabled = true;
  }
}

bootstrap();
