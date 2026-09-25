let documents = [];
let editMode = false;
let toastTimer = null;

/* =========================
   LOAD DATA
========================= */

document.addEventListener("DOMContentLoaded", function () {
  loadDocuments();

  const form = document.getElementById("documentForm");

  if (form) {
    form.addEventListener("submit", submitForm);
  }
});

function loadDocuments() {
  showLoading("Memuat data...");

  google.script.run

    .withSuccessHandler(function (result) {
      hideLoading();

      documents = Array.isArray(result) ? result : [];

      renderDocuments();
    })

    .withFailureHandler(function (error) {
      hideLoading();

      showToast(getErrorMessage(error), "error");
    })

    .getDocuments();
}

/* =========================
   RENDER
========================= */

function renderDocuments() {
  const grid = document.getElementById("documentGrid");

  const empty = document.getElementById("emptyState");

  const total = document.getElementById("totalDocuments");

  const search = document.getElementById("searchInput");

  const keyword = search ? search.value.trim().toLowerCase() : "";

  const filtered = documents.filter(function (doc) {
    return (
      String(doc.nama || "")
        .toLowerCase()
        .includes(keyword) ||
      String(doc.deskripsi || "")
        .toLowerCase()
        .includes(keyword)
    );
  });

  total.textContent = filtered.length;

  grid.innerHTML = "";

  if (filtered.length === 0) {
    empty.style.display = "block";

    return;
  }

  empty.style.display = "none";

  filtered.forEach(function (doc) {
    grid.appendChild(createDocumentCard(doc));
  });
}

/* =========================
   CARD
========================= */

function createDocumentCard(doc) {
  const card = document.createElement("article");

  card.className = "document-card";

  const imageUrl = convertDriveImageUrl(doc.gambarUtamaUrl);

  let galleryHTML = "";

  if (Array.isArray(doc.gambarTambahan)) {
    galleryHTML = doc.gambarTambahan
      .map(function (url) {
        const img = convertDriveImageUrl(url);

        return `
            <img
              src="${escapeAttribute(img)}"
              alt="Gambar tambahan"
              onclick="openLightbox('${escapeAttribute(img)}')"
              onerror="this.style.display='none'"
            >
          `;
      })
      .join("");
  }

  card.innerHTML = `

    ${
      imageUrl
        ? `
          <img
            class="card-image"
            src="${escapeAttribute(imageUrl)}"
            alt="${escapeAttribute(doc.nama)}"
            onclick="openLightbox('${escapeAttribute(imageUrl)}')"
            onerror="this.src='';this.alt='Gambar gagal dimuat'"
          >
        `
        : `
          <div class="card-image"
               style="
                 display:flex;
                 align-items:center;
                 justify-content:center;
                 background:#f3f4f6;
                 color:#9ca3af;
               ">
            Tidak ada gambar
          </div>
        `
    }


    <div class="card-body">

      <h3 class="card-name">
        ${escapeHTML(doc.nama || "")}
      </h3>


      <p class="card-description">
        ${escapeHTML(doc.deskripsi || "-")}
      </p>


      ${
        galleryHTML
          ? `
            <div class="gallery">
              ${galleryHTML}
            </div>
          `
          : ""
      }


      <div class="card-actions">

        ${
          doc.pdfUrl
            ? `
              <button
                class="btn pdf"
                onclick="openPdf('${escapeAttribute(doc.pdfUrl)}')"
              >
                📄 Buka PDF
              </button>
            `
            : ""
        }


        ${
          doc.pdfUrl
            ? `
              <button
                class="btn download"
                onclick="downloadPDF(
                  '${escapeAttribute(doc.pdfUrl)}',
                  '${escapeAttribute(doc.nama)}'
                )"
              >
                ⬇ Download
              </button>
            `
            : ""
        }


        <button
          class="btn edit"
          onclick="openEditModal('${escapeAttribute(doc.id)}')"
        >
          ✏ Edit
        </button>


        <button
          class="btn danger"
          onclick="deleteDocumentConfirm('${escapeAttribute(doc.id)}')"
        >
          🗑 Hapus
        </button>

      </div>

    </div>

  `;

  return card;
}

/* =========================
   DRIVE IMAGE
========================= */

function convertDriveImageUrl(url) {
  if (!url) {
    return "";
  }

  const match = String(url).match(/\/d\/([^/]+)/);

  if (match) {
    return (
      "https://drive.google.com/thumbnail?id=" +
      encodeURIComponent(match[1]) +
      "&sz=w1200"
    );
  }

  return url;
}

/* =========================
   PDF
========================= */

function openPdf(url) {
  if (!url) {
    showToast("File PDF tidak tersedia.", "error");

    return;
  }

  window.open(url, "_blank");
}

function downloadPDF(url, name) {
  if (!url) {
    showToast("File PDF tidak tersedia.", "error");

    return;
  }

  const match = String(url).match(/\/d\/([^/]+)/);

  if (!match) {
    window.open(url, "_blank");

    return;
  }

  const fileId = match[1];

  const downloadUrl =
    "https://drive.google.com/uc?export=download&id=" +
    encodeURIComponent(fileId);

  const link = document.createElement("a");

  link.href = downloadUrl;

  link.download = sanitizeDownloadName(name) + ".pdf";

  link.target = "_blank";

  link.rel = "noopener";

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  showToast("Download PDF dimulai.", "success");
}

function sanitizeDownloadName(name) {
  return String(name || "dokumen")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
}

/* =========================
   CREATE
========================= */

function openCreateModal() {
  editMode = false;

  document.getElementById("modalTitle").textContent = "Tambah Dokumen";

  document.getElementById("documentForm").reset();

  document.getElementById("documentId").value = "";

  document.getElementById("replaceExtraContainer").style.display = "none";

  showModal();
}

/* =========================
   EDIT
========================= */

function openEditModal(id) {
  const doc = documents.find(function (item) {
    return String(item.id) === String(id);
  });

  if (!doc) {
    showToast("Data dokumen tidak ditemukan.", "error");

    return;
  }

  editMode = true;

  document.getElementById("modalTitle").textContent = "Edit Dokumen";

  document.getElementById("documentId").value = doc.id || "";

  document.getElementById("documentName").value = doc.nama || "";

  document.getElementById("description").value = doc.deskripsi || "";

  document.getElementById("pdfFile").value = "";

  document.getElementById("mainImageFile").value = "";

  document.getElementById("extraImageFiles").value = "";

  document.getElementById("replaceExtraContainer").style.display = "block";

  document.getElementById("replaceExtraImages").checked = false;

  showModal();
}

/* =========================
   MODAL
========================= */

function showModal() {
  document.getElementById("modal").classList.add("show");
}

function closeModal() {
  document.getElementById("modal").classList.remove("show");
}

/* =========================
   SAVE
========================= */

async function submitForm(event) {
  event.preventDefault();

  const name = document.getElementById("documentName").value.trim();

  const description = document.getElementById("description").value.trim();

  if (!name) {
    showToast("Nama dokumen wajib diisi.", "error");

    return;
  }

  try {
    showLoading(editMode ? "Menyimpan perubahan..." : "Membuat dokumen...");

    const pdf = await fileToObject(document.getElementById("pdfFile").files[0]);

    const mainImage = await fileToObject(
      document.getElementById("mainImageFile").files[0],
    );

    const extraFiles = document.getElementById("extraImageFiles").files;

    const extraImages = [];

    for (let i = 0; i < extraFiles.length; i++) {
      extraImages.push(await fileToObject(extraFiles[i]));
    }

    const payload = {
      id: document.getElementById("documentId").value,

      nama: name,

      deskripsi: description,

      pdf: pdf,

      gambarUtama: mainImage,

      gambarTambahan: extraImages,

      replaceExtraImages: document.getElementById("replaceExtraImages").checked,
    };

    if (editMode) {
      google.script.run

        .withSuccessHandler(handleSaveSuccess)

        .withFailureHandler(handleSaveError)

        .updateDocument(payload);
    } else {
      google.script.run

        .withSuccessHandler(handleSaveSuccess)

        .withFailureHandler(handleSaveError)

        .createDocument(payload);
    }
  } catch (error) {
    hideLoading();

    showToast(error.message || "Gagal membaca file.", "error");
  }
}

/* =========================
   FILE READER
========================= */

function fileToObject(file) {
  return new Promise(function (resolve, reject) {
    if (!file) {
      resolve(null);

      return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
      const base64 = event.target.result.split(",")[1];

      resolve({
        name: file.name,

        mimeType: file.type,

        size: file.size,

        data: base64,
      });
    };

    reader.onerror = function () {
      reject(new Error("Gagal membaca file."));
    };

    reader.readAsDataURL(file);
  });
}

/* =========================
   SAVE SUCCESS
========================= */

function handleSaveSuccess(result) {
  hideLoading();

  closeModal();

  showToast(
    result && result.message ? result.message : "Data berhasil disimpan.",
    "success",
  );

  loadDocuments();
}

/* =========================
   SAVE ERROR
========================= */

function handleSaveError(error) {
  hideLoading();

  showToast(getErrorMessage(error), "error");
}

/* =========================
   DELETE
========================= */

function deleteDocumentConfirm(id) {
  const doc = documents.find(function (item) {
    return String(item.id) === String(id);
  });

  if (!doc) {
    return;
  }

  const confirmed = confirm(
    'Hapus dokumen "' +
      doc.nama +
      '"?\n\nFolder Google Drive juga akan dipindahkan ke Sampah.',
  );

  if (!confirmed) {
    return;
  }

  showLoading("Menghapus dokumen...");

  google.script.run

    .withSuccessHandler(function (result) {
      hideLoading();

      showToast(
        result && result.message ? result.message : "Dokumen berhasil dihapus.",
        "success",
      );

      loadDocuments();
    })

    .withFailureHandler(function (error) {
      hideLoading();

      showToast(getErrorMessage(error), "error");
    })

    .deleteDocument(id);
}

/* =========================
   LIGHTBOX
========================= */

function openLightbox(url) {
  if (!url) {
    return;
  }

  document.getElementById("lightboxImage").src = url;

  document.getElementById("lightbox").classList.add("show");
}

function closeLightbox() {
  document.getElementById("lightbox").classList.remove("show");

  document.getElementById("lightboxImage").src = "";
}

/* =========================
   TOAST
========================= */

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");

  toast.textContent = message;

  toast.className = "toast show";

  if (type === "error") {
    toast.classList.add("error");
  }

  clearTimeout(toastTimer);

  toastTimer = setTimeout(function () {
    toast.classList.remove("show");
  }, 3500);
}

/* =========================
   LOADING
========================= */

function showLoading(message) {
  document.getElementById("loadingText").textContent =
    message || "Memproses...";

  document.getElementById("loading").classList.add("show");
}

function hideLoading() {
  document.getElementById("loading").classList.remove("show");
}

/* =========================
   ERROR
========================= */

function getErrorMessage(error) {
  if (!error) {
    return "Terjadi kesalahan.";
  }

  if (typeof error === "string") {
    return error;
  }

  return error.message || "Terjadi kesalahan.";
}

/* =========================
   ESCAPE
========================= */

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

/* =========================
   KEYBOARD
========================= */

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeModal();

    closeLightbox();
  }
});

/* =========================
   CLOSE MODAL OUTSIDE
========================= */

document.getElementById("modal")?.addEventListener("click", function (event) {
  if (event.target === this) {
    closeModal();
  }
});
