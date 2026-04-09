let currentUser = null,
  allUsers = {},
  currentMuscleTab = "pectoraux";
let editingTemplateIdx = null,
  draftTemplate = { name: "", exercises: [] };
let activeSession = null,
  timerInterval = null,
  selectedGender = "";

function saveUsers() {
  localStorage.setItem("ironlog_users", JSON.stringify(allUsers));
}
function loadUsers() {
  try {
    allUsers = JSON.parse(localStorage.getItem("ironlog_users") || "{}");
  } catch (e) {
    allUsers = {};
  }
}
function getUserData(u) {
  if (!allUsers[u])
    allUsers[u] = {
      password: "",
      name: "",
      exercises: [...DEFAULT_EXOS],
      sessions: [],
      templates: [],
      profile: {},
    };
  if (!allUsers[u].templates) allUsers[u].templates = [];
  if (!allUsers[u].profile) allUsers[u].profile = {};
  return allUsers[u];
}
function getExos() {
  return getUserData(currentUser).exercises;
}
function getSessions() {
  return getUserData(currentUser).sessions;
}
function getTemplates() {
  return getUserData(currentUser).templates;
}

loadUsers();

function switchAuthTab(tab) {
  ["login", "register"].forEach((t) => {
    document
      .getElementById("tab-" + t)
      .classList.toggle("active", t === tab);
    document.getElementById("form-" + t).style.display =
      t === tab ? "" : "none";
  });
}
function handleLogin() {
  const u = document.getElementById("login-username").value.trim();
  const p = document.getElementById("login-password").value;
  const err = document.getElementById("login-error");
  if (!u || !p) {
    err.textContent = "Remplis tous les champs.";
    return;
  }
  if (!allUsers[u] || allUsers[u].password !== p) {
    err.textContent = "Identifiants incorrects.";
    return;
  }
  err.textContent = "";
  currentUser = u;
  startApp();
}
function handleRegister() {
  const name = document.getElementById("reg-name").value.trim();
  const u = document.getElementById("reg-username").value.trim();
  const p = document.getElementById("reg-password").value;
  const err = document.getElementById("reg-error");
  if (!name || !u || !p) {
    err.textContent = "Remplis tous les champs.";
    return;
  }
  if (p.length < 6) {
    err.textContent = "Mot de passe trop court.";
    return;
  }
  if (allUsers[u]) {
    err.textContent = "Nom d'utilisateur pris.";
    return;
  }
  allUsers[u] = {
    password: p,
    name,
    exercises: [...DEFAULT_EXOS],
    sessions: [],
    templates: [],
    profile: {},
  };
  saveUsers();
  currentUser = u;
  startApp();
}
function logout() {
  currentUser = null;
  activeSession = null;
  clearInterval(timerInterval);
  document.getElementById("app").style.display = "none";
  document.getElementById("auth-page").style.display = "flex";
}

function startApp() {
  document.getElementById("auth-page").style.display = "none";
  document.getElementById("app").style.display = "block";
  document.getElementById("user-display").textContent =
    getUserData(currentUser).name;
  initMuscleSelector();
  updateTopbarAvatar();
  navigate("dashboard");
}

function navigate(page) {
  ["dashboard", "exercices", "seances", "live", "historique"].forEach(
    (p) => {
      const el = document.getElementById("page-" + p);
      if (el) el.classList.remove("active");
    },
  );
  ["dashboard", "exercices", "seances", "historique"].forEach((n) => {
    const el = document.getElementById("nav-" + n);
    if (el) el.classList.remove("active");
  });
  const el = document.getElementById("page-" + page);
  if (el) el.classList.add("active");
  const nav = document.getElementById("nav-" + page);
  if (nav) nav.classList.add("active");
  else if (page === "live")
    document.getElementById("nav-seances").classList.add("active");
  if (page === "dashboard") renderDashboard();
  if (page === "exercices") renderCurrentMuscleTab();
  if (page === "seances") renderTemplates();
  if (page === "live") renderLiveSession();
  if (page === "historique") renderHistory();
}

// DASHBOARD
function renderDashboard() {
  const sessions = getSessions(),
    templates = getTemplates();
  document.getElementById("stat-sessions").textContent = sessions.length;
  document.getElementById("stat-templates").textContent =
    templates.length;
  let vol = 0;
  sessions.forEach((s) =>
    s.blocks.forEach((b) =>
      b.sets.forEach((set) => {
        vol += (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0);
      }),
    ),
  );
  document.getElementById("stat-volume").textContent =
    vol >= 1000 ? Math.round(vol / 1000) + "k" : Math.round(vol);
  const last = sessions[sessions.length - 1];
  const lc = document.getElementById("last-session-content");
  if (last) {
    const d = new Date(last.date);
    lc.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between">
<div><div style="font-weight:600;font-size:.9375rem">${last.templateName || "Séance libre"}</div>
<div style="font-size:.8125rem;color:var(--muted);margin-top:2px">${last.blocks.map((b) => b.exoName).join(", ")}</div></div>
<div style="text-align:right"><div style="font-size:.75rem;color:var(--muted)">${d.toLocaleDateString("fr-FR")}</div>
<div style="font-size:.8125rem;color:var(--accent);font-weight:600">${last.blocks.length} exo${last.blocks.length > 1 ? "s" : ""}</div></div></div>`;
  }
  const mc = {};
  MUSCLES.forEach((m) => (mc[m.id] = 0));
  sessions.forEach((s) =>
    s.blocks.forEach((b) => {
      if (mc[b.muscle] !== undefined) mc[b.muscle]++;
    }),
  );
  const mx = Math.max(...Object.values(mc), 1);
  document.getElementById("muscle-chart").innerHTML = MUSCLES.map(
    (m) => `
    <div style="display:flex;align-items:center;gap:.625rem;margin-bottom:.5rem">
<div style="font-size:.8125rem;color:var(--muted);width:90px;flex-shrink:0">${m.label}</div>
<div class="progress-bar-wrap" style="flex:1"><div class="progress-bar" style="width:${Math.round((mc[m.id] / mx) * 100)}%"></div></div>
<div style="font-size:.75rem;color:var(--muted);width:20px;text-align:right">${mc[m.id]}</div>
    </div>`,
  ).join("");
}

// EXERCISES
function initMuscleSelector() {
  document.getElementById("muscle-tabs").innerHTML = MUSCLES.map(
    (m) =>
      `<button class="muscle-tab ${m.id === currentMuscleTab ? "active" : ""}" onclick="setMuscleTab('${m.id}')">${m.label}</button>`,
  ).join("");
  document.getElementById("new-exo-muscle").innerHTML =
    '<option value="">-- Choisir --</option>' +
    MUSCLES.map(
      (m) => `<option value="${m.id}">${m.label}</option>`,
    ).join("");
}
function setMuscleTab(id) {
  currentMuscleTab = id;
  document
    .querySelectorAll(".muscle-tab")
    .forEach((t) =>
      t.classList.toggle(
        "active",
        t.textContent === MUSCLES.find((m) => m.id === id).label,
      ),
    );
  renderCurrentMuscleTab();
}
function renderCurrentMuscleTab() {
  const exos = getExos().filter((e) => e.muscle === currentMuscleTab);
  document.getElementById("exo-list").innerHTML = exos.length
    ? exos
        .map(
          (e) => `
    <div class="exo-item ${e.custom ? "custom" : ""}" onclick="openExoDetail('${e.id}')">
<div><div class="exo-name">${e.name}</div>
  <div class="exo-tags"><span class="tag tag-type">${e.type}</span>
    <span class="tag tag-level-${e.level}">${{ easy: "Débutant", medium: "Intermédiaire", hard: "Avancé" }[e.level]}</span>
    ${e.custom ? '<span class="tag" style="background:#f9731618;color:var(--accent)">Perso</span>' : ""}
  </div></div>
<span style="color:var(--muted2)">›</span>
    </div>`,
        )
        .join("")
    : '<div class="empty"><div class="empty-icon">🏋️</div>Aucun exercice pour ce groupe.</div>';
}
function saveNewExo() {
  const name = document.getElementById("new-exo-name").value.trim();
  const muscle = document.getElementById("new-exo-muscle").value;
  if (!name || !muscle) {
    alert("Remplis le nom et le groupe.");
    return;
  }
  getExos().push({
    id: "c" + Date.now(),
    name,
    muscle,
    type: document.getElementById("new-exo-type").value,
    level: document.getElementById("new-exo-level").value,
    custom: true,
  });
  saveUsers();
  closeModal("modal-add-exo");
  document.getElementById("new-exo-name").value = "";
  setMuscleTab(muscle);
  navigate("exercices");
  showToast("Exercice ajouté !");
}
function openExoDetail(id) {
  const exo = getExos().find((e) => e.id === id);
  if (!exo) return;
  document.getElementById("detail-name").textContent = exo.name;
  const sessions = getSessions();
  const history = sessions
    .map((s) => {
      const b = s.blocks.find((x) => x.exoId === id);
      if (!b) return null;
      const valid = b.sets.filter((s) => s.weight && s.reps);
      return {
        date: s.date,
        sets: b.sets,
        maxW: Math.max(...b.sets.map((s) => parseFloat(s.weight) || 0)),
        avgW: valid.length
          ? valid.reduce((a, s) => a + (parseFloat(s.weight) || 0), 0) /
            valid.length
          : 0,
        avgR: valid.length
          ? valid.reduce((a, s) => a + (parseInt(s.reps) || 0), 0) /
            valid.length
          : 0,
      };
    })
    .filter(Boolean);
  document.getElementById("detail-body").innerHTML = `
    <div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">
<span class="tag tag-type">${exo.type}</span>
<span class="tag tag-level-${exo.level}">${{ easy: "Débutant", medium: "Intermédiaire", hard: "Avancé" }[exo.level]}</span>
<span class="tag tag-type">${MUSCLES.find((m) => m.id === exo.muscle)?.label}</span>
    </div>
    ${
history.length
  ? `<div style="font-size:.8125rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.75rem">Historique (${history.length} séance${history.length > 1 ? "s" : ""})</div>
    ${history
.slice(-5)
.reverse()
.map(
  (h) => `
<div style="background:var(--bg3);border-radius:8px;padding:.75rem;margin-bottom:.5rem">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
    <span style="font-size:.8125rem;color:var(--muted)">${new Date(h.date).toLocaleDateString("fr-FR")}</span>
    <span style="font-size:.875rem;color:var(--accent);font-weight:600">Max: ${h.maxW} kg</span>
  </div>
  <div style="display:flex;gap:.375rem;flex-wrap:wrap">${h.sets.map((s, i) => `<span style="background:var(--bg4);padding:3px 8px;border-radius:4px;font-size:.75rem;color:var(--muted)">${i + 1}: ${s.weight || "—"}kg×${s.reps || "—"}</span>`).join("")}</div>
  ${h.avgW ? `<div style="margin-top:.5rem;font-size:.75rem;color:var(--muted2)">Moy. ${h.avgW.toFixed(1)} kg · ${h.avgR.toFixed(1)} reps/série</div>` : ""}
</div>`,
)
.join("")}`
  : '<div style="color:var(--muted);font-size:.875rem;text-align:center;padding:1rem 0">Pas encore utilisé en séance</div>'
    }
    ${exo.custom ? `<button class="btn-secondary" style="width:100%;margin-top:.75rem;color:var(--danger);border-color:var(--danger)" onclick="deleteExo('${id}')">Supprimer</button>` : ""}`;
  openModal("modal-detail");
}
function deleteExo(id) {
  if (!confirm("Supprimer ?")) return;
  getUserData(currentUser).exercises = getExos().filter(
    (e) => e.id !== id,
  );
  saveUsers();
  closeModal("modal-detail");
  renderCurrentMuscleTab();
  showToast("Supprimé");
}

// TEMPLATES
function renderTemplates() {
  const banner = document.getElementById("active-session-banner");
  if (activeSession) {
    banner.style.display = "block";
    document.getElementById("active-banner-sub").textContent =
      activeSession.templateName +
      " · " +
      activeSession.blocks.length +
      " exercice(s)";
  } else banner.style.display = "none";
  const templates = getTemplates();
  const list = document.getElementById("templates-list");
  if (!templates.length) {
    list.innerHTML =
      '<div class="empty"><div class="empty-icon">📋</div>Aucune séance type.<br>Crée ta première !</div>';
    return;
  }
  list.innerHTML = templates
    .map((t, i) => {
      const rows = t.exercises
        .map((e) => {
          const ex = getExos().find((x) => x.id === e.exoId);
          return ex
            ? `${ex.name} <span style="color:var(--accent)">${e.sets}×</span>`
            : null;
        })
        .filter(Boolean);
      const muscles = [
        ...new Set(
          t.exercises
            .map((e) => getExos().find((x) => x.id === e.exoId)?.muscle)
            .filter(Boolean),
        ),
      ];
      const muscleLabels = muscles
        .map((m) => MUSCLES.find((x) => x.id === m)?.label)
        .filter(Boolean)
        .join(" · ");
      // Stats from past sessions of this template
      const pastSessions = getSessions().filter(
        (s) => s.templateName === t.name,
      );
      const durSessions = pastSessions.filter((s) => s.durationSec);
      const avgDur = durSessions.length
        ? Math.round(
            durSessions.reduce((a, s) => a + s.durationSec, 0) /
              durSessions.length,
          )
        : null;
      // Avg weight per exercise
      const exoAvgWeights = t.exercises.map((e) => {
        const ex = getExos().find((x) => x.id === e.exoId);
        const allSets = pastSessions
          .flatMap((s) =>
            s.blocks
              .filter((b) => b.exoId === e.exoId)
              .flatMap((b) => b.sets),
          )
          .filter((s) => s.weight);
        const avg = allSets.length
          ? (
              allSets.reduce(
                (a, s) => a + (parseFloat(s.weight) || 0),
                0,
              ) / allSets.length
            ).toFixed(1)
          : null;
        return { name: ex?.name || "?", sets: e.sets, avg };
      });
      return `<div class="template-card">
<div class="template-header">
  <div><div class="template-name">${t.name}</div><div style="font-size:.75rem;color:var(--accent);margin-top:2px">${muscleLabels}</div></div>
  <div class="template-actions">
    <button class="btn-icon" onclick="editTemplate(${i})">✏️</button>
    <button class="btn-icon" onclick="deleteTemplate(${i})">🗑</button>
  </div>
</div>
<div style="font-size:.8125rem;color:var(--muted);margin-bottom:.875rem;line-height:1.8">${rows.join(" &nbsp;·&nbsp; ")}</div>
${
  avgDur || exoAvgWeights.some((e) => e.avg)
    ? `<div style="margin-bottom:.875rem">
  ${
    avgDur || pastSessions.length
      ? `<div style="display:flex;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap">
    ${avgDur ? `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:.375rem .75rem;font-size:.8125rem;display:flex;align-items:center;gap:.375rem"><span style="color:var(--muted)">⏱ Durée moy.</span><strong style="color:var(--accent)">${fmtDuration(avgDur)}</strong></div>` : ""}
    ${pastSessions.length ? `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:.375rem .75rem;font-size:.8125rem;color:var(--muted)">${pastSessions.length} séance${pastSessions.length > 1 ? "s" : ""}</div>` : ""}
  </div>`
      : ""
  }
  ${
    exoAvgWeights.some((e) => e.avg)
      ? `<div style="background:var(--bg3);border-radius:8px;padding:.625rem .875rem">
    <div style="font-size:.6875rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem">Poids moyens</div>
    ${exoAvgWeights
      .map(
        (
          e,
        ) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:.25rem 0;border-bottom:1px solid #2d2d3340">
      <span style="font-size:.8125rem;color:var(--text)">${e.name}</span>
      <span style="font-size:.8125rem">${e.avg ? `<strong style="color:var(--accent)">${e.avg} kg</strong> <span style="color:var(--muted2);font-size:.75rem">× ${e.sets} séries</span>` : '<span style="color:var(--muted2)">—</span>'}</span>
    </div>`,
      )
      .join("")}
  </div>`
      : ""
  }
</div>`
    : ""
}
<button class="btn-start" onclick="startSession(${i})">
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
  Commencer
</button>
    </div>`;
    })
    .join("");
}
function openCreateTemplate() {
  editingTemplateIdx = null;
  draftTemplate = { name: "", exercises: [] };
  document.getElementById("tpl-name").value = "";
  document.getElementById("modal-template-title").textContent =
    "Nouvelle séance type";
  renderDraftRows();
  openModal("modal-create-template");
}
function editTemplate(idx) {
  editingTemplateIdx = idx;
  draftTemplate = JSON.parse(JSON.stringify(getTemplates()[idx]));
  document.getElementById("tpl-name").value = draftTemplate.name;
  document.getElementById("modal-template-title").textContent =
    "Modifier la séance";
  renderDraftRows();
  openModal("modal-create-template");
}
function deleteTemplate(idx) {
  if (!confirm("Supprimer cette séance type ?")) return;
  getUserData(currentUser).templates.splice(idx, 1);
  saveUsers();
  renderTemplates();
  showToast("Séance supprimée");
}
function renderDraftRows() {
  const c = document.getElementById("tpl-exo-rows");
  if (!draftTemplate.exercises.length) {
    c.innerHTML =
      '<div style="color:var(--muted);font-size:.8125rem;margin-bottom:.625rem;text-align:center">Aucun exercice ajouté</div>';
    return;
  }
  c.innerHTML = draftTemplate.exercises
    .map((e, i) => {
      const exo = getExos().find((x) => x.id === e.exoId);
      return `<div class="template-exo-row">
<div class="template-exo-info">
  <div class="template-exo-row-name">${exo?.name || "?"}</div>
  <div class="template-exo-row-muscle">${MUSCLES.find((m) => m.id === exo?.muscle)?.label || ""}</div>
</div>
<div class="series-control">
  <button class="series-btn" onclick="changeSets(${i},-1)">−</button>
  <div class="series-count">${e.sets}</div>
  <button class="series-btn" onclick="changeSets(${i},1)">+</button>
  <span style="font-size:.75rem;color:var(--muted);margin-left:2px">séries</span>
</div>
<button class="btn-icon" onclick="removeDraftExo(${i})" style="margin-left:.375rem;flex-shrink:0">✕</button>
    </div>`;
    })
    .join("");
}
function changeSets(idx, d) {
  draftTemplate.exercises[idx].sets = Math.max(
    1,
    Math.min(10, draftTemplate.exercises[idx].sets + d),
  );
  renderDraftRows();
}
function removeDraftExo(idx) {
  draftTemplate.exercises.splice(idx, 1);
  renderDraftRows();
}
function openPickForTemplate() {
  renderPickList("");
  document.getElementById("pick-search").value = "";
  openModal("modal-pick-exo");
}
function filterPickList() {
  renderPickList(
    document.getElementById("pick-search").value.trim().toLowerCase(),
  );
}
function renderPickList(filter) {
  const exos = getExos().filter(
    (e) => !filter || e.name.toLowerCase().includes(filter),
  );
  const grouped = {};
  MUSCLES.forEach((m) => (grouped[m.id] = []));
  exos.forEach((e) => {
    if (grouped[e.muscle]) grouped[e.muscle].push(e);
  });
  document.getElementById("pick-list").innerHTML = MUSCLES.map((m) => {
    if (!grouped[m.id].length) return "";
    return `<div style="margin-bottom:.875rem">
<div style="font-size:.75rem;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.375rem">${m.label}</div>
${grouped[m.id]
  .map(
    (
      e,
    ) => `<div class="exo-item" style="margin-bottom:.375rem" onclick="pickExo('${e.id}')">
  <div class="exo-name" style="font-size:.875rem">${e.name}</div><span style="color:var(--accent)">+</span>
</div>`,
  )
  .join("")}
    </div>`;
  }).join("");
}
function pickExo(id) {
  if (draftTemplate.exercises.find((e) => e.exoId === id)) {
    showToast("Déjà dans la séance");
    return;
  }
  draftTemplate.exercises.push({ exoId: id, sets: 3 });
  closeModal("modal-pick-exo");
  renderDraftRows();
}
function saveTemplate() {
  const name = document.getElementById("tpl-name").value.trim();
  if (!name) {
    alert("Donne un nom à la séance.");
    return;
  }
  if (!draftTemplate.exercises.length) {
    alert("Ajoute au moins un exercice.");
    return;
  }
  draftTemplate.name = name;
  const templates = getUserData(currentUser).templates;
  if (editingTemplateIdx !== null)
    templates[editingTemplateIdx] = JSON.parse(
      JSON.stringify(draftTemplate),
    );
  else templates.push(JSON.parse(JSON.stringify(draftTemplate)));
  saveUsers();
  closeModal("modal-create-template");
  renderTemplates();
  showToast(
    editingTemplateIdx !== null ? "Séance modifiée !" : "Séance créée !",
  );
}

// LIVE SESSION
function startSession(tplIdx) {
  if (
    activeSession &&
    !confirm("Une séance est déjà en cours. La remplacer ?")
  )
    return;
  clearInterval(timerInterval);
  const tpl = getTemplates()[tplIdx];

  // Get last performed sets for hints
  const sessions = getSessions();
  const lastData = {};
  for (let i = sessions.length - 1; i >= 0; i--) {
    sessions[i].blocks.forEach((b) => {
      if (!lastData[b.exoId]) lastData[b.exoId] = b.sets;
    });
  }

  activeSession = {
    templateName: tpl.name,
    startTime: Date.now(),
    blocks: tpl.exercises.map((e) => {
      const exo = getExos().find((x) => x.id === e.exoId);
      return {
        exoId: e.exoId,
        exoName: exo?.name || "?",
        muscle: exo?.muscle || "",
        sets: Array.from({ length: e.sets }, () => ({
          reps: "",
          weight: "",
        })),
        lastSets: lastData[e.exoId] || [],
      };
    }),
  };
  navigate("live");
}

function renderLiveSession() {
  if (!activeSession) {
    navigate("seances");
    return;
  }
  document.getElementById("live-session-title").textContent =
    activeSession.templateName;
  startTimer();
  document.getElementById("live-blocks").innerHTML = activeSession.blocks
    .map(
      (block, bi) => `
    <div class="live-exo-block">
<div class="live-exo-header">
  <div class="live-exo-name">${block.exoName}</div>
  <div class="live-exo-muscle">${MUSCLES.find((m) => m.id === block.muscle)?.label || ""}</div>
</div>
<table class="set-table">
  <thead><tr><th></th><th>Poids (kg)</th><th>Reps</th></tr></thead>
  <tbody>${block.sets
    .map((set, si) => {
      const hint = block.lastSets[si];
      const hintW = hint?.weight || "";
      const hintR = hint?.reps || "";
      return `<tr>
      <td><div class="set-num-badge ${set.reps && set.weight ? "done" : ""}" id="badge-${bi}-${si}">${si + 1}</div></td>
      <td>
        <input type="number" class="live-input ${set.weight ? "has-val" : ""}" id="w-${bi}-${si}"
          value="${set.weight}" min="0" step=".5" placeholder="${hintW || "kg"}"
          oninput="liveUpdate(${bi},${si},'weight',this.value)">
        ${hintW ? `<div class="last-hint">Dernier: ${hintW} kg</div>` : ""}
      </td>
      <td>
        <input type="number" class="live-input ${set.reps ? "has-val" : ""}" id="r-${bi}-${si}"
          value="${set.reps}" min="0" placeholder="${hintR || "reps"}"
          oninput="liveUpdate(${bi},${si},'reps',this.value)">
        ${hintR ? `<div class="last-hint">Dernier: ${hintR}</div>` : ""}
      </td>
    </tr>`;
    })
    .join("")}</tbody>
</table>
    </div>`,
    )
    .join("");
}
function liveUpdate(bi, si, field, val) {
  activeSession.blocks[bi].sets[si][field] = val;
  const set = activeSession.blocks[bi].sets[si];
  const badge = document.getElementById(`badge-${bi}-${si}`);
  if (badge) badge.classList.toggle("done", !!(set.reps && set.weight));
  const inp = document.getElementById(
    (field === "weight" ? "w" : "r") + `-${bi}-${si}`,
  );
  if (inp) inp.classList.toggle("has-val", !!val);
}
function startTimer() {
  clearInterval(timerInterval);
  const el = document.getElementById("live-timer");
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - activeSession.startTime) / 1000);
    el.textContent =
      String(Math.floor(s / 60)).padStart(2, "0") +
      ":" +
      String(s % 60).padStart(2, "0");
  }, 1000);
}
function finishSession() {
  if (!activeSession) return;
  const durationSec = Math.floor(
    (Date.now() - activeSession.startTime) / 1000,
  );
  getUserData(currentUser).sessions.push({
    date: new Date().toISOString(),
    templateName: activeSession.templateName,
    durationSec,
    blocks: JSON.parse(
      JSON.stringify(
        activeSession.blocks.map((b) => ({ ...b, lastSets: undefined })),
      ),
    ),
  });
  saveUsers();
  clearInterval(timerInterval);
  activeSession = null;
  showToast("Séance enregistrée !");
  navigate("historique");
}

function fmtDuration(sec) {
  if (!sec) return null;
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (m > 0) return `${m}min${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

// HISTORY
function renderHistory() {
  const sessions = getSessions();
  const list = document.getElementById("history-list");
  if (!sessions.length) {
    list.innerHTML =
      '<div class="empty"><div class="empty-icon">📋</div>Aucune séance enregistrée</div>';
    return;
  }
  list.innerHTML = [...sessions]
    .reverse()
    .map((s, ri) => {
      const idx = sessions.length - 1 - ri;
      const vol = s.blocks.reduce(
        (a, b) =>
          a +
          b.sets.reduce(
            (x, set) =>
              x +
              (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0),
            0,
          ),
        0,
      );
      const muscles = [
        ...new Set(
          s.blocks.map(
            (b) => MUSCLES.find((m) => m.id === b.muscle)?.label,
          ),
        ),
      ]
        .filter(Boolean)
        .join(" · ");
      return `<div class="session-card" onclick="openSessionDetail(${idx})">
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <div style="font-size:.75rem;color:var(--muted);margin-bottom:.25rem">${new Date(s.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
    <div style="font-weight:600;font-size:.9375rem;margin-bottom:.25rem">${s.templateName || "Séance libre"}</div>
    <div style="font-size:.8125rem;color:var(--muted)">${s.blocks.map((b) => b.exoName).join(" · ")}</div>
    <div style="font-size:.75rem;color:var(--muted2);margin-top:.25rem">${muscles}</div>
  </div>
  <div style="text-align:right;flex-shrink:0;margin-left:1rem">
    <div class="session-vol">${Math.round(vol)}</div>
    <div style="font-size:.6875rem;color:var(--muted);text-transform:uppercase">kg vol.</div>
    ${s.durationSec ? `<div style="font-size:.75rem;color:var(--muted2);margin-top:.25rem">⏱ ${fmtDuration(s.durationSec)}</div>` : ""}
  </div>
</div>
    </div>`;
    })
    .join("");
}

function openSessionDetail(idx) {
  const s = getSessions()[idx];
  if (!s) return;
  const allSessions = getSessions();
  document.getElementById("detail-name").textContent =
    s.templateName || "Séance libre";
  document.getElementById("detail-body").innerHTML = `
    <div style="display:flex;gap:1rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap">
<span style="font-size:.8125rem;color:var(--muted)">${new Date(s.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
${s.durationSec ? `<span style="font-size:.8125rem;color:var(--accent);background:#f9731618;padding:2px 10px;border-radius:10px;font-weight:600">⏱ ${fmtDuration(s.durationSec)}</span>` : ""}
    </div>
    ${s.blocks
.map((b) => {
  const valid = b.sets.filter((x) => x.weight && x.reps);
  const avgW = valid.length
    ? valid.reduce((a, x) => a + (parseFloat(x.weight) || 0), 0) /
      valid.length
    : null;
  const avgR = valid.length
    ? valid.reduce((a, x) => a + (parseInt(x.reps) || 0), 0) /
      valid.length
    : null;
  // Global average for this exo across all sessions
  const allValid = allSessions
    .flatMap((sess) => sess.blocks.filter((x) => x.exoId === b.exoId))
    .flatMap((x) => x.sets)
    .filter((x) => x.weight && x.reps);
  const gAvgW = allValid.length
    ? allValid.reduce((a, x) => a + (parseFloat(x.weight) || 0), 0) /
      allValid.length
    : null;
  const gAvgR = allValid.length
    ? allValid.reduce((a, x) => a + (parseInt(x.reps) || 0), 0) /
      allValid.length
    : null;
  // Previous session for this exo
  let prevSets = null;
  for (let i = idx - 1; i >= 0; i--) {
    const found = allSessions[i].blocks.find((x) => x.exoId === b.exoId);
    if (found) {
      prevSets = found.sets;
      break;
    }
  }
  return `<div style="background:var(--bg3);border-radius:8px;padding:.875rem;margin-bottom:.75rem">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
    <span style="font-weight:600;font-size:.9375rem">${b.exoName}</span>
    <span class="live-exo-muscle">${MUSCLES.find((m) => m.id === b.muscle)?.label || ""}</span>
  </div>
  <div style="display:flex;gap:.375rem;flex-wrap:wrap;margin-bottom:.625rem">
    ${b.sets
      .map(
        (
          set,
          i,
        ) => `<div style="background:var(--bg4);border-radius:6px;padding:.375rem .75rem;font-size:.8125rem">
      <span style="color:var(--muted)">${i + 1}.</span> <strong>${set.weight || "—"}</strong> kg × <strong>${set.reps || "—"}</strong>
    </div>`,
      )
      .join("")}
  </div>
  ${
    avgW !== null
      ? `<div style="display:flex;gap:1rem;padding:.5rem .75rem;background:var(--bg4);border-radius:6px;font-size:.8125rem;flex-wrap:wrap">
    <div><span style="color:var(--muted)">Moy. séance:</span> <strong style="color:var(--accent)">${avgW.toFixed(1)} kg × ${avgR.toFixed(1)} reps</strong></div>
    ${gAvgW !== null ? `<div><span style="color:var(--muted)">Moy. globale:</span> <strong>${gAvgW.toFixed(1)} kg × ${gAvgR.toFixed(1)} reps</strong></div>` : ""}
  </div>`
      : ""
  }
  ${prevSets ? `<div style="margin-top:.5rem;font-size:.75rem;color:var(--muted2)">Séance préc.: ${prevSets.map((s, i) => `${i + 1}. ${s.weight || "?"}kg×${s.reps || "?"}`).join(" · ")}</div>` : ""}
</div>`;
})
.join("")}
    <button class="btn-secondary" style="width:100%;margin-top:.25rem;color:var(--danger);border-color:var(--danger)" onclick="deleteSession(${idx})">Supprimer cette séance</button>`;
  openModal("modal-detail");
}
function deleteSession(idx) {
  if (!confirm("Supprimer ?")) return;
  getUserData(currentUser).sessions.splice(idx, 1);
  saveUsers();
  closeModal("modal-detail");
  renderHistory();
  showToast("Supprimée");
}

// PROFILE
function openProfile() {
  const data = getUserData(currentUser),
    p = data.profile || {};
  document.getElementById("profile-fullname").textContent = data.name;
  document.getElementById("profile-initials").textContent = data.name
    .charAt(0)
    .toUpperCase();
  document.getElementById("profile-age").value = p.age || "";
  document.getElementById("profile-weight").value = p.weight || "";
  document.getElementById("profile-height").value = p.height || "";
  selectedGender = p.gender || "";
  document
    .getElementById("gender-homme")
    .classList.toggle("active", selectedGender === "homme");
  document
    .getElementById("gender-femme")
    .classList.toggle("active", selectedGender === "femme");
  const prev = document.getElementById("profile-pic-preview"),
    ini = document.getElementById("profile-initials"),
    btnR = document.getElementById("btn-remove-pic");
  if (p.photo) {
    prev.src = p.photo;
    prev.style.display = "block";
    ini.style.display = "none";
    btnR.style.display = "inline-flex";
  } else {
    prev.style.display = "none";
    ini.style.display = "block";
    btnR.style.display = "none";
  }
  updateImc();
  openModal("modal-profile");
}
function selectGender(g) {
  selectedGender = g;
  document
    .getElementById("gender-homme")
    .classList.toggle("active", g === "homme");
  document
    .getElementById("gender-femme")
    .classList.toggle("active", g === "femme");
}
function handleProfilePic(input) {
  const file = input.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = (e) => {
    const p = document.getElementById("profile-pic-preview");
    p.src = e.target.result;
    p.style.display = "block";
    document.getElementById("profile-initials").style.display = "none";
    document.getElementById("btn-remove-pic").style.display =
      "inline-flex";
  };
  r.readAsDataURL(file);
}
function removeProfilePic() {
  document.getElementById("profile-pic-preview").src = "";
  document.getElementById("profile-pic-preview").style.display = "none";
  document.getElementById("profile-initials").style.display = "block";
  document.getElementById("btn-remove-pic").style.display = "none";
  document.getElementById("profile-pic-input").value = "";
}
function updateImc() {
  const w = parseFloat(document.getElementById("profile-weight").value),
    h = parseFloat(document.getElementById("profile-height").value);
  const badge = document.getElementById("imc-badge");
  if (!w || !h) {
    badge.style.display = "none";
    return;
  }
  const imc = w / (h / 100) ** 2;
  const map = [
    [18.5, "Insuffisance pondérale", "#60a5fa"],
    [25, "Poids normal ✓", "#4ade80"],
    [30, "Surpoids", "#fb923c"],
    [Infinity, "Obésité", "#f87171"],
  ];
  const [, label, color] = map.find(([t]) => imc < t);
  badge.style.display = "block";
  document.getElementById("imc-val").textContent = imc.toFixed(1);
  document.getElementById("imc-val").style.color = color;
  document.getElementById("imc-label").textContent = label;
}
function saveProfile() {
  const data = getUserData(currentUser);
  const photo =
    document.getElementById("profile-pic-preview").style.display !==
    "none"
      ? document.getElementById("profile-pic-preview").src
      : null;
  data.profile = {
    gender: selectedGender,
    age: document.getElementById("profile-age").value,
    weight: document.getElementById("profile-weight").value,
    height: document.getElementById("profile-height").value,
    photo: photo || null,
  };
  saveUsers();
  updateTopbarAvatar();
  closeModal("modal-profile");
  showToast("Profil mis à jour !");
}
function updateTopbarAvatar() {
  const data = getUserData(currentUser),
    av = document.getElementById("user-avatar"),
    p = data.profile || {};
  if (p.photo) av.innerHTML = `<img src="${p.photo}" alt="avatar">`;
  else {
    av.innerHTML = data.name.charAt(0).toUpperCase();
    av.style.background = "var(--accent)";
  }
}

// MODALS
function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
document.querySelectorAll(".modal-overlay").forEach((el) =>
  el.addEventListener("click", (e) => {
    if (e.target === el) closeModal(el.id);
  }),
);

// TOAST
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

// KEYBOARD
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Enter" &&
    document.getElementById("auth-page").style.display !== "none" &&
    document.getElementById("form-login").style.display !== "none"
  )
    handleLogin();
});
