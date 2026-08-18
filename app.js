const COLONNE = 7;

// valori ammessi: servono al rendering (tendina stato) e alla validazione
const SEVERITA = ["Critical", "High", "Medium", "Low"];
const STATI = ["Open", "In Progress", "Closed"];

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

function creaSelectStato(vuln) {
  const select = document.createElement("select");
  select.className = "stato-select stato-" + slug(vuln.stato);
  select.dataset.id = vuln.id;

  STATI.forEach(function (stato) {
    const option = document.createElement("option");
    option.value = stato;
    option.textContent = stato;
    if (stato === vuln.stato) option.selected = true;
    select.appendChild(option);
  });

  // uno stato non previsto (es. dato vecchio in localStorage) resterebbe
  // invisibile fra le opzioni: lo aggiungo così non viene riscritto di nascosto
  if (STATI.indexOf(vuln.stato) === -1) {
    const option = document.createElement("option");
    option.value = vuln.stato;
    option.textContent = vuln.stato + " (?)";
    option.selected = true;
    select.appendChild(option);
  }

  return select;
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
      td.appendChild(creaSelectStato(vuln));
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

function creaRigaVuota(messaggio) {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = COLONNE;
  td.className = "vuoto";
  td.textContent = messaggio || "Nessuna vulnerabilità registrata.";
  tr.appendChild(td);
  return tr;
}

function renderTable(vulnerabilita, messaggioVuoto) {
  const tbody = document.querySelector("#vulnList tbody");
  if (!tbody) return;

  const lista = Array.isArray(vulnerabilita) ? vulnerabilita : [];

  // un solo reflow: costruisco tutto in memoria e sostituisco il contenuto
  const frammento = document.createDocumentFragment();
  if (lista.length === 0) {
    frammento.appendChild(creaRigaVuota(messaggioVuoto));
  } else {
    lista.forEach(function (vuln) {
      frammento.appendChild(creaRiga(vuln));
    });
  }

  tbody.replaceChildren(frammento);
}

// Delega: listener sul tbody, sopravvivono ai re-render delle righe.
const tbodyVuln = document.querySelector("#vulnList tbody");

tbodyVuln.addEventListener("click", function (e) {
  const bottone = e.target.closest(".btn-elimina");
  if (!bottone) return;
  onEliminaVuln(bottone.dataset.id);
});

tbodyVuln.addEventListener("change", function (e) {
  const select = e.target.closest(".stato-select");
  if (!select) return;
  if (!onCambiaStato(select.dataset.id, select.value)) return;

  const vuln = vulnerabilita.find(function (v) {
    return String(v.id) === String(select.dataset.id);
  });

  if (vuln && !corrispondeAiFiltri(vuln)) {
    // il nuovo stato esce dal filtro attivo (es. filtro "Open" e la metti
    // "Closed"): la riga deve sparire, quindi qui il re-render serve
    aggiornaVista();
    return;
  }

  // altrimenti ricoloro solo questa select: un renderTable completo la
  // ricreerebbe da zero e il focus da tastiera salterebbe via
  select.className = "stato-select stato-" + slug(select.value);
});

// --- caricamento dati ---

const STORAGE_KEY = "vulntracker_data";

function caricaVulnerabilita() {
  let salvato;
  try {
    // carica i dati dal localStorage
    salvato = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    // localStorage può lanciare: modalità privata, o file:// su alcuni browser
    console.warn("localStorage non accessibile, uso dati di prova.", e);
    return datiRandom();
  }

  if (salvato === null) {
    // se i dati sono assenti ritorna dati randomici
    console.info("Chiave " + STORAGE_KEY + " assente, uso dati di prova.");
    return datiRandom();
  }

  let dati;
  try {
    // assegna a dati la stringa dei dati salvati nel formato JSON
    dati = JSON.parse(salvato);
  } catch (e) {
    // se i dati sono invalidi ritorna dati randomici
    console.warn("Contenuto di " + STORAGE_KEY + " non è JSON valido.", e);
    return datiRandom();
  }

  // se i dati non sono un array ritorna dati randomici
  if (!Array.isArray(dati)) {
    console.warn("Contenuto di " + STORAGE_KEY + " non è un array.");
    return datiRandom();
  }

  return dati;
}

function salvaVulnerabilita(lista) {
  try {
    // converte l'array in testo in formato JSON e lo salva nel localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch (e) {
    console.warn("Salvataggio su localStorage fallito.", e);
  }
}

// --- dati di prova, da rimuovere quando ci sarà il form di inserimento ---

const SISTEMI =["login-service", "portal-web", "api-gateway", "billing-db", "mail-relay"];
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

// --- stato ---

// unica fonte di verità: renderTable e salvaVulnerabilita leggono sempre da qui
let vulnerabilita = [];

function onEliminaVuln(id) {
  const primaCount = vulnerabilita.length;
  // confronto tra stringhe: dataset.id è sempre stringa, vuln.id potrebbe
  // arrivare come numero da un JSON scritto a mano
  vulnerabilita = vulnerabilita.filter(function (v) {
    return String(v.id) !== String(id);
  });

  if (vulnerabilita.length === primaCount) {
    console.warn("Nessuna vulnerabilità con id " + id + ".");
    return;
  }

  salvaVulnerabilita(vulnerabilita);
  aggiornaVista();
}

// ritorna true se lo stato è stato aggiornato
function onCambiaStato(id, nuovoStato) {
  if (STATI.indexOf(nuovoStato) === -1) {
    console.warn("Stato non ammesso: " + nuovoStato);
    return false;
  }

  const vuln = vulnerabilita.find(function (v) {
    return String(v.id) === String(id);
  });

  if (!vuln) {
    console.warn("Nessuna vulnerabilità con id " + id + ".");
    return false;
  }

  if (vuln.stato === nuovoStato) return false;

  vuln.stato = nuovoStato;
  salvaVulnerabilita(vulnerabilita);
  return true;
}

// --- filtri e ordinamento ---

// "" = nessun filtro / ordine di inserimento
const filtri = { severita: "", stato: "", ordine: "" };

// per ordinare serve un rango numerico: "Critical" < "Low" in ordine
// alfabetico darebbe un risultato senza senso
const RANGO_SEVERITA = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function rango(severita) {
  const r = RANGO_SEVERITA[severita];
  return r === undefined ? 99 : r; // severità sconosciute in fondo
}

function corrispondeAiFiltri(vuln) {
  if (filtri.severita && vuln.severita !== filtri.severita) return false;
  if (filtri.stato && vuln.stato !== filtri.stato) return false;
  return true;
}

function filtriAttivi() {
  return Boolean(filtri.severita || filtri.stato);
}

function vistaCorrente() {
  // filter restituisce già un array nuovo, quindi il sort qui sotto non
  // riordina la lista originale: l'ordine di inserimento resta intatto
  const vista = vulnerabilita.filter(corrispondeAiFiltri);

  if (filtri.ordine === "sev-desc") {
    vista.sort(function (a, b) { return rango(a.severita) - rango(b.severita); });
  } else if (filtri.ordine === "sev-asc") {
    vista.sort(function (a, b) { return rango(b.severita) - rango(a.severita); });
  }

  return vista;
}

function aggiornaVista() {
  const vista = vistaCorrente();

  // con i filtri attivi "nessuna vulnerabilità registrata" sarebbe falso:
  // i dati ci sono, è la vista che è vuota
  renderTable(vista, filtriAttivi()
    ? "Nessuna vulnerabilità corrisponde ai filtri."
    : "Nessuna vulnerabilità registrata.");

  const contatore = document.querySelector("#contatore");
  if (contatore) {
    contatore.textContent = vista.length === vulnerabilita.length
      ? vulnerabilita.length + " vulnerabilità"
      : vista.length + " di " + vulnerabilita.length + " vulnerabilità";
  }
}

function popolaFiltro(selettore, valori, etichettaTutti) {
  const select = document.querySelector(selettore);
  if (!select) return;

  const tutti = document.createElement("option");
  tutti.value = "";
  tutti.textContent = etichettaTutti;
  select.appendChild(tutti);

  valori.forEach(function (valore) {
    const option = document.createElement("option");
    option.value = valore;
    option.textContent = valore;
    select.appendChild(option);
  });
}

function collegaControlli() {
  // le opzioni vengono da SEVERITA e STATI: aggiungere un valore lì lo fa
  // comparire nei filtri senza toccare l'HTML
  popolaFiltro("#filtroSeverita", SEVERITA, "Tutte");
  popolaFiltro("#filtroStato", STATI, "Tutti");

  const campi = [
    { selettore: "#filtroSeverita", chiave: "severita" },
    { selettore: "#filtroStato", chiave: "stato" },
    { selettore: "#ordinamento", chiave: "ordine" }
  ];

  campi.forEach(function (campo) {
    const select = document.querySelector(campo.selettore);
    if (!select) return;
    select.addEventListener("change", function (e) {
      filtri[campo.chiave] = e.target.value;
      aggiornaVista();
    });
  });

  const azzera = document.querySelector("#azzeraFiltri");
  if (azzera) {
    azzera.addEventListener("click", function () {
      filtri.severita = "";
      filtri.stato = "";
      filtri.ordine = "";
      campi.forEach(function (campo) {
        const select = document.querySelector(campo.selettore);
        if (select) select.value = "";
      });
      aggiornaVista();
    });
  }
}

function addId() {
  // stringa come negli id di datiRandom, così i confronti sono omogenei;
  // il while evita la collisione fra due inserimenti nello stesso millisecondo
  let id = String(Date.now());
  while (vulnerabilita.some(function (v) { return String(v.id) === id; })) {
    id = String(Number(id) + 1);
  }
  return id;
}

function addVuln() {
  const name_el = document.getElementById("vul_name");
  let nameVal = name_el.value;
  if (!nameVal) {
    alert("Inserisci un nome valido");
    return false;
  }

  console.log(nameVal);
  return nameVal;
}

function addVulSev() {
  const sev_el = document.querySelector('input[name="severita"]:checked');
  if (!sev_el) {
    alert("Seleziona una severità");
    return false;
  }

  let sevVal = sev_el.value;
  console.log(sevVal);
  return sevVal;
}

function addSys() {
  const sys_el = document.getElementById("vul_sys");
  let sysVal = sys_el.value;
  if (!sysVal) {
    alert("Inserisci il sistema");
    return false;
  }

  console.log(sysVal);
  return sysVal;
}

function addVulst() {
  const state_el = document.querySelector('input[name="stato"]:checked');
  if (!state_el) {
    alert("Seleziona uno stato");
    return false;
  }

  let stateVal = state_el.value;
  console.log(stateVal);
  return stateVal;
}

function addVuld() {
  const desc_el = document.getElementById("vul_desc");
  let descVal = desc_el.value;
  console.log(descVal);
  return descVal;
}

function addDate(){
  // input type="date" restituisce "aaaa-mm-gg"
  const date_el = document.getElementById("vul_date").value;
  if (!date_el) {
    alert("Inserisci una data valida");
    return false;
  }

  // il resto della tabella usa gg/mm/aaaa (vedi dataCasuale): converto qui
  const parti = date_el.split("-");
  return parti[2] + "/" + parti[1] + "/" + parti[0];
}

function pushVul() {
  // un campo per volta: ogni add* mostra già il proprio alert, valutarli tutti
  // insieme ne farebbe comparire uno dietro l'altro
  const nome = addVuln();
  if (!nome) return false;

  const severita = addVulSev();
  if (!severita) return false;

  const sistema = addSys();
  if (!sistema) return false;

  const stato = addVulst();
  if (!stato) return false;

  const data = addDate();
  if (!data) return false;

  vulnerabilita.push({
    id: addId(),
    nome: nome,
    severita: severita,
    sistema: sistema,
    stato: stato,
    descrizione: addVuld(), // opzionale: può restare vuota
    data: data
  });

  salvaVulnerabilita(vulnerabilita);
  aggiornaVista();
  document.getElementById("formVulnerabilita").reset();
}

// --- avvio ---

vulnerabilita = caricaVulnerabilita();
salvaVulnerabilita(vulnerabilita); // persiste anche il seed random, così l'eliminazione regge al refresh
collegaControlli();
aggiornaVista();
