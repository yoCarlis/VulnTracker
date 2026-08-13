const COLONNE = 7;

// "Critical" -> "critical", usato per le classi CSS dei badge
function slug(valore) {
  return String(valore).toLowerCase().replace(/\s+/g, "-");
}

function creaBadge(testo, tipo) {
  const span = document.createElement("span");
  span.className = "badge " + tipo + "-" + slug(testo);
  span.textContent = testo;
  return span;
}

function creaRiga(vuln) {
  const tr = document.createElement("tr");
  tr.dataset.id = vuln.id;

  // l'id resta solo in data-id: serve per eliminare, non va mostrato
  const celle = [vuln.nome, null, vuln.sistema, null, vuln.descrizione, vuln.data];
  celle.forEach(function (valore, i) {
    const td = document.createElement("td");
    if (i === 1) {
      td.appendChild(creaBadge(vuln.severita, "sev"));
    } else if (i === 3) {
      td.appendChild(creaBadge(vuln.stato, "stato"));
    } else {
      // textContent (non innerHTML): nome e descrizione sono input utente
      td.textContent = valore;
      if (i === 4) td.className = "descrizione";
    }
    tr.appendChild(td);
  });

  const azioni = document.createElement("td");
  const elimina = document.createElement("button");
  elimina.type = "button";
  elimina.className = "btn-elimina";
  elimina.dataset.id = vuln.id;
  elimina.textContent = "Elimina";
  azioni.appendChild(elimina);
  tr.appendChild(azioni);

  return tr;
}

function creaRigaVuota() {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = COLONNE;
  td.className = "vuoto";
  td.textContent = "Nessuna vulnerabilità registrata.";
  tr.appendChild(td);
  return tr;
}

function renderTable(vulnerabilita) {
  const tbody = document.querySelector("#vulnList tbody");
  if (!tbody) return;

  const lista = Array.isArray(vulnerabilita) ? vulnerabilita : [];

  // un solo reflow: costruisco tutto in memoria e sostituisco il contenuto
  const frammento = document.createDocumentFragment();
  if (lista.length === 0) {
    frammento.appendChild(creaRigaVuota());
  } else {
    lista.forEach(function (vuln) {
      frammento.appendChild(creaRiga(vuln));
    });
  }

  tbody.replaceChildren(frammento);
}

// Delega: un solo listener sul tbody, sopravvive ai re-render.
// Definisci onEliminaVuln(id) dove gestisci lo stato.
document.querySelector("#vulnList tbody").addEventListener("click", function (e) {
  const bottone = e.target.closest(".btn-elimina");
  if (!bottone) return;
  if (typeof onEliminaVuln === "function") {
    onEliminaVuln(bottone.dataset.id);
  }
});

// --- caricamento dati ---

const STORAGE_KEY = "vulntracker_data";

function caricaVulnerabilita() {
  let salvato;
  try {
    salvato = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    // localStorage può lanciare: modalità privata, o file:// su alcuni browser
    console.warn("localStorage non accessibile, uso dati di prova.", e);
    return datiRandom();
  }

  if (salvato === null) {
    console.info("Chiave " + STORAGE_KEY + " assente, uso dati di prova.");
    return datiRandom();
  }

  let dati;
  try {
    dati = JSON.parse(salvato);
  } catch (e) {
    console.warn("Contenuto di " + STORAGE_KEY + " non è JSON valido.", e);
    return datiRandom();
  }

  if (!Array.isArray(dati)) {
    console.warn("Contenuto di " + STORAGE_KEY + " non è un array.");
    return datiRandom();
  }

  return dati;
}

function salvaVulnerabilita(lista) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch (e) {
    console.warn("Salvataggio su localStorage fallito.", e);
  }
}

// --- dati di prova, da rimuovere quando ci sarà il form di inserimento ---

const SEVERITA = ["Critical", "High", "Medium", "Low"];
const STATI = ["Open", "In Progress", "Closed"];
const SISTEMI = ["login-service", "portal-web", "api-gateway", "billing-db", "mail-relay"];
const TIPI = [
  { nome: "SQL Injection", descrizione: "Parametro non sanitizzato nel form login." },
  { nome: "XSS riflesso", descrizione: "Query string riflessa nella pagina di ricerca." },
  { nome: "Credenziali in chiaro", descrizione: "Password di servizio nel file di configurazione." },
  { nome: "Libreria obsoleta", descrizione: "Dipendenza con CVE noto non aggiornata da mesi." },
  { nome: "Directory listing", descrizione: "Elenco dei file esposto sulla cartella upload." },
  { nome: "Cookie senza HttpOnly", descrizione: "Cookie di sessione leggibile via JavaScript." },
  { nome: "Rate limit assente", descrizione: "Endpoint di login senza limite sui tentativi." }
];

function scegli(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function dataCasuale() {
  const giorniIndietro = Math.floor(Math.random() * 60);
  const d = new Date(Date.now() - giorniIndietro * 86400000);
  const pad = function (n) { return String(n).padStart(2, "0"); };
  return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
}

function datiRandom(quante) {
  const n = quante || 5;
  const adesso = Date.now();
  const lista = [];
  for (let i = 0; i < n; i++) {
    const tipo = scegli(TIPI);
    lista.push({
      id: String(adesso + i), // +i così gli id restano univoci
      nome: tipo.nome,
      severita: scegli(SEVERITA),
      sistema: scegli(SISTEMI),
      stato: scegli(STATI),
      descrizione: tipo.descrizione,
      data: dataCasuale()
    });
  }
  return lista;
}

// --- avvio ---

renderTable(caricaVulnerabilita());
