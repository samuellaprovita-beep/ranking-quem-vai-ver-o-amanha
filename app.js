const config = window.ARENA_RANKING_CONFIG;
const podium = document.querySelector("#podium");
const rankingBody = document.querySelector("#ranking-body");
const status = document.querySelector("#status");
const updatedAt = document.querySelector("#updated-at");
const refreshButton = document.querySelector("#refresh-button");
const speakButton = document.querySelector("#speak-button");

let ranking = [];
let loading = false;

const scoreFormatter = new Intl.NumberFormat("pt-BR");
const ordinalNames = ["Primeiro lugar", "Segundo lugar", "Terceiro lugar"];

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderPodium(entries) {
  podium.replaceChildren();

  if (entries.length === 0) {
    podium.append(createElement("article", "podium-card podium-card-empty", "Aguardando os primeiros resultados."));
    return;
  }

  entries.slice(0, 3).forEach((entry, index) => {
    const card = createElement("article", "podium-card");
    const position = createElement("p", "podium-position", ordinalNames[index]);
    const name = createElement("p", "podium-name", entry.display_name);
    const scoreLine = createElement("p", "podium-score", "Melhor pontuação");
    const score = createElement("strong", "", scoreFormatter.format(entry.best_score));

    scoreLine.append(score);
    card.append(position, name, scoreLine);
    podium.append(card);
  });
}

function renderTable(entries) {
  rankingBody.replaceChildren();

  if (entries.length === 0) {
    const row = document.createElement("tr");
    const cell = createElement("td", "empty-state", "Nenhuma pontuação registrada neste evento.");
    cell.colSpan = 3;
    row.append(cell);
    rankingBody.append(row);
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement("tr");
    row.append(
      createElement("td", "rank", `${entry.rank_position}º`),
      createElement("td", "", entry.display_name),
      createElement("td", "score", scoreFormatter.format(entry.best_score))
    );
    rankingBody.append(row);
  });
}

function renderRanking(entries) {
  ranking = entries;
  renderPodium(entries);
  renderTable(entries);
  speakButton.disabled = entries.length === 0 || !("speechSynthesis" in window);
}

async function loadRanking() {
  if (loading) return;

  loading = true;
  refreshButton.disabled = true;
  status.classList.remove("status-error");
  status.textContent = "Atualizando ranking...";

  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/get_arena_leaderboard`, {
      method: "POST",
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_event_name: config.eventName })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`HTTP ${response.status}: ${details}`);
    }

    const entries = await response.json();
    renderRanking(entries);
    status.textContent = entries.length === 0
      ? "O ranking está pronto e aguardando resultados."
      : `${entries.length} participante${entries.length === 1 ? "" : "s"} no ranking.`;
    updatedAt.textContent = `Última atualização: ${new Date().toLocaleTimeString("pt-BR")}`;
  } catch (error) {
    console.error("Não foi possível carregar o ranking.", error);
    status.classList.add("status-error");
    status.textContent = "Não foi possível atualizar o ranking. Tentaremos novamente em breve.";
  } finally {
    loading = false;
    refreshButton.disabled = false;
  }
}

function speakPodium() {
  if (ranking.length === 0 || !("speechSynthesis" in window)) return;

  const announcement = ranking.slice(0, 3)
    .map((entry, index) =>
      `${ordinalNames[index]}, ${entry.display_name}, com ${entry.best_score} pontos.`
    )
    .join(" ");

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`Ranking da Arena. ${announcement}`);
  utterance.lang = "pt-BR";
  window.speechSynthesis.speak(utterance);
}

refreshButton.addEventListener("click", loadRanking);
speakButton.addEventListener("click", speakPodium);

loadRanking();
window.setInterval(loadRanking, config.refreshIntervalMs);
