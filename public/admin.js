const STORAGE_KEY = "verent_booths_v1";

function getInputs() {
  const titles = Array.from(document.querySelectorAll('.title')).map(e => e.value);
  const smalls = Array.from(document.querySelectorAll('.small')).map(e => e.value);

  const arr = [];
  for (let i = 0; i < 4; i++) {
    arr.push({ title: titles[i] || "", small: smalls[i] || "" });
  }
  return arr;
}

function setInputs(data) {
  document.querySelectorAll('.title').forEach((el, i) => {
    el.value = data[i]?.title || "";
  });

  document.querySelectorAll('.small').forEach((el, i) => {
    el.value = data[i]?.small || "";
  });

  renderPreview();
}

function renderPreview() {
  const arr = getInputs();
  const preview = document.getElementById("preview");
  preview.innerHTML = "";

  arr.forEach(item => {
    const div = document.createElement("div");
    div.className = "chip";
    div.innerHTML = `
      <div class="chip-title">${item.title || "(empty)"}</div>
      <div class="chip-small">${item.small || ""}</div>
    `;
    preview.appendChild(div);
  });
}

document.getElementById("btn-save").onclick = () => {
  const data = getInputs();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  alert("Saved!");
};

document.getElementById("btn-load").onclick = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return alert("No saved data!");
  setInputs(JSON.parse(raw));
};

document.getElementById("btn-export").onclick = () => {
  const data = JSON.stringify(getInputs(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "booths.json";
  a.click();
};

document.getElementById("btn-import").onclick = () => {
  document.getElementById("import-file").click();
};

document.getElementById("import-file").onchange = (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      setInputs(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      alert("Imported!");
    } catch (err) {
      alert("Import failed");
    }
  };

  reader.readAsText(file);
};

// live updating preview
document.getElementById("inputs-grid").addEventListener("input", renderPreview);

// Load default on start
setInputs([
  { title: "IPEKA Puri", small: "20 — 24 Oct | 8 AM — 6 PM" },
  { title: "Emporium Pluit Mall", small: "22 Oct — 2 Nov | 10 AM — 10 PM" },
  { title: "Big Bad Wolf, PIK", small: "Date / time" },
  { title: "UPH", small: "Date / time" }
]);
