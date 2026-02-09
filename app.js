const CONFIG = {
  supabaseUrl: "https://ngjuarfnlepwmvzmkukw.supabase.co",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nanVhcmZubGVwd212em1rdWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMjI4NzcsImV4cCI6MjA4NDY5ODg3N30.w67LAEv_D6dn-N2IIGEBKbniwWNdDe7IuBEWptsEqC0",
  landingUrl: "https://cili-cidadelimpa.vercel.app/",
  downloadUrl: "https://cili-cidadelimpa.vercel.app/",
  pixKey: "cili.cidadelimpa@gmail.com",
  pixOwner: "CiLi - Cidade Limpa",
};

const state = {
  supabase: null,
  map: null,
  markersLayer: null,
};

const byId = (id) => document.getElementById(id);

function setDownloadLinks() {
  byId("downloadHeaderBtn").href = CONFIG.downloadUrl || CONFIG.landingUrl;
  byId("downloadPrimaryBtn").href = CONFIG.downloadUrl || CONFIG.landingUrl;
}

function setDonationInfo() {
  byId("pixKey").textContent = CONFIG.pixKey || "Defina sua chave PIX no arquivo landing/app.js";
  byId("pixOwner").textContent = CONFIG.pixOwner || "";
  byId("copyPixBtn").addEventListener("click", async () => {
    const key = CONFIG.pixKey || "";
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      byId("copyPixBtn").textContent = "Chave copiada";
      setTimeout(() => {
        byId("copyPixBtn").textContent = "Copiar chave PIX";
      }, 1800);
    } catch (_e) {
      alert("Nao foi possivel copiar automaticamente. Copie manualmente.");
    }
  });
}

function ensureMap() {
  if (state.map) return;
  state.map = L.map("publicMap").setView([-14.235, -51.9253], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(state.map);
  state.markersLayer = L.layerGroup().addTo(state.map);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markerColor(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "resolvido") return "#16A34A";
  return "#DC2626";
}

async function loadCities() {
  const cityFilter = byId("cityFilter");
  cityFilter.innerHTML = `<option value="">Todos os municipios</option>`;

  const { data, error } = await state.supabase.rpc("public_map_cities", { p_limit: 400 });
  if (error) throw error;

  (data || []).forEach((row) => {
    const opt = document.createElement("option");
    opt.value = row.city || "";
    opt.textContent = `${row.city} (${row.total_reports})`;
    cityFilter.appendChild(opt);
  });
}

async function loadMapReports() {
  ensureMap();
  const city = byId("cityFilter").value || null;
  const status = byId("statusFilter").value || "todos";
  const mapHint = byId("mapHint");

  mapHint.textContent = "Carregando pontos no mapa...";
  state.markersLayer.clearLayers();

  const { data, error } = await state.supabase.rpc("public_map_reports", {
    p_city: city,
    p_status: status,
    p_limit: 900,
  });

  if (error) throw error;
  const rows = data || [];
  const bounds = [];

  rows.forEach((r) => {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const marker = L.circleMarker([lat, lon], {
      radius: 7,
      color: markerColor(r.status),
      fillColor: markerColor(r.status),
      fillOpacity: 0.75,
      weight: 1,
    });

    const image = r.image_url
      ? `<img src="${escapeHtml(r.image_url)}" alt="Foto do relato" style="width:100%;max-width:220px;border-radius:8px;margin-top:8px;" />`
      : "";

    marker.bindPopup(
      `
        <div style="min-width:220px;">
          <b>${escapeHtml(r.category_label || "Categoria")}</b><br/>
          ID: ${escapeHtml(r.id)}<br/>
          Cidade: ${escapeHtml(r.city || "-")}<br/>
          Status: ${escapeHtml(r.status || "-")}<br/>
          Apoios: ${Number(r.supports_count || 0)} | Comentarios: ${Number(r.comments_count || 0)}
          ${image}
        </div>
      `
    );

    marker.addTo(state.markersLayer);
    bounds.push([lat, lon]);
  });

  if (bounds.length > 0) {
    state.map.fitBounds(bounds, { padding: [24, 24] });
    mapHint.textContent = `${rows.length} publicacoes carregadas.`;
  } else {
    mapHint.textContent = "Nenhuma publicacao encontrada para este filtro.";
  }
}

async function loadRanking() {
  const city = byId("cityFilter").value || null;
  const rankingList = byId("rankingList");
  const rankingHint = byId("rankingHint");

  rankingList.innerHTML = "<p class='hint'>Carregando ranking...</p>";
  const { data, error } = await state.supabase.rpc("public_top_issues_by_city", {
    p_city: city,
    p_limit: 5,
  });
  if (error) throw error;

  const rows = data || [];
  if (!rows.length) {
    rankingList.innerHTML = "<p class='hint'>Sem dados para o municipio selecionado.</p>";
    rankingHint.textContent = "Sem ocorrencias no filtro atual.";
    return;
  }

  rankingHint.textContent = city
    ? `Top problemas de ${city}`
    : "Top problemas gerais de todos os municipios";

  rankingList.innerHTML = rows
    .map((r, idx) => {
      return `
        <article class="rank-item">
          <h4>${idx + 1}. ${escapeHtml(r.category_label || r.category_id || "Nao informado")}</h4>
          <p>Relatos: <b>${Number(r.total_reports || 0)}</b></p>
          <p>Apoios: <b>${Number(r.total_supports || 0)}</b> | Comentarios: <b>${Number(r.total_comments || 0)}</b></p>
          <p>Pendentes: <b>${Number(r.pending_reports || 0)}</b> | Resolvidos: <b>${Number(r.resolved_reports || 0)}</b></p>
        </article>
      `;
    })
    .join("");
}

async function refreshAll() {
  try {
    await Promise.all([loadMapReports(), loadRanking()]);
  } catch (err) {
    console.error("Falha ao carregar dados da landpage:", err);
    byId("mapHint").textContent = "Erro ao carregar dados. Tente novamente.";
    byId("rankingList").innerHTML = "<p class='hint'>Falha ao carregar ranking.</p>";
  }
}

async function bootstrap() {
  setDownloadLinks();
  setDonationInfo();

  if (!window.supabase?.createClient) {
    byId("mapHint").textContent = "Biblioteca Supabase indisponivel.";
    return;
  }

  state.supabase = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  ensureMap();

  try {
    await loadCities();
  } catch (err) {
    console.error("Erro ao carregar municipios:", err);
    byId("cityFilter").innerHTML = `<option value="">Todos os municipios</option>`;
  }

  byId("reloadBtn").addEventListener("click", refreshAll);
  byId("cityFilter").addEventListener("change", refreshAll);
  byId("statusFilter").addEventListener("change", refreshAll);

  await refreshAll();
}

bootstrap();
