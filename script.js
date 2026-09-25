/* =====================================================
   CONFIGURATION
===================================================== */

/*
 * MASUKKAN URL WEB APP GOOGLE APPS SCRIPT DI SINI.
 *
 * Contoh:
 *
 * const API_URL =
 *   "https://script.google.com/macros/s/XXXXXXXX/exec";
 */

const API_URL =
  "https://script.google.com/macros/s/AKfycbwDYEQGlH-EPlXO8XXkF9YxoPe5oMp5DJFxwS_P2ZRFOU-QKedu0VPD16VBBQhJGsHZ/exec";

/* =====================================================
   GLOBAL
===================================================== */

let documents = [];

let editMode = false;

let toastTimer = null;

/* =====================================================
   DOM READY
===================================================== */

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("documentForm");

  if (form) {
    form.addEventListener("submit", submitForm);
  }

  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.addEventListener("input", renderDocuments);
  }

  loadDocuments();
});

/* =====================================================
   API REQUEST
===================================================== */

async function apiRequest(action, payload = null, id = null) {
  if (!API_URL || API_URL.includes("MASUKKAN_URL")) {
    throw new Error("API_URL belum diisi di script.js.");
  }

  const body = {
    action: action,
  };

  if (payload !== null) {
    body.payload = payload;
  }

  if (id !== null) {
    body.id = id;
  }

  const response = await fetch(API_URL, {
    method: "POST",

    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },

    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("HTTP Error " + response.status);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || "Terjadi kesalahan pada server.");
  }

  return result.data;
}

/* =====================================================
   LOAD DOCUMENTS
===================================================== */

async function loadDocuments() {
  try {
    showLoading("Memuat data...");

    documents = await apiRequest("getDocuments");

    if (!Array.isArray(documents)) {
      documents = [];
    }

    renderDocuments();
  } catch (error) {
    console.error(error);

    showToast(getErrorMessage(error), "error");
  } finally {
    hideLoading();
  }
}

/* =====================================================
   RENDER DOCUMENTS
===================================================== */

function renderDocuments() {
  const grid = document.getElementById("documentGrid");

  const emptyState = document.getElementById("emptyState");

  const totalElement = document.getElementById("totalDocuments");

  const searchInput = document.getElementById("searchInput");

  if (!grid) {
    return;
  }

  const keyword = searchInput ? searchInput.value.trim().toLowerCase() : "";

  const filtered = documents.filter(function (doc) {
    const name = String(doc.nama || "").toLowerCase();

    const description = String(doc.deskripsi || "").toLowerCase();

    return name.includes(keyword) || description.includes(keyword);
  });

  if (totalElement) {
    totalElement.textContent = filtered.length;
  }

  grid.innerHTML = "";

  if (filtered.length === 0) {
    if (emptyState) {
      emptyState.style.display = "block";
    }

    return;
  }

  if (emptyState) {
    emptyState.style.display = "none";
  }

  filtered.forEach(function (doc) {
    grid.appendChild(createDocumentCard(doc));
  });
}

/* =====================================================
   CREATE CARD
===================================================== */

function createDocumentCard(doc) {
  const card = document.createElement("article");

  card.className = "document-card";

  const imageUrl = convertDriveImageUrl(doc.gambarUtamaUrl);

  let galleryHTML = "";

  if (Array.isArray(doc.gambarTambahan)) {
    galleryHTML = doc.gambarTambahan
      .map(function (url) {
        const image = convertDriveImageUrl(url);

        if (!image) {
          return "";
        }

        return `

              <img
                src="${escapeAttribute(image)}"
                alt="Gambar tambahan"
                onclick="openLightbox('${escapeJS(image)}')"
                onerror="this.style.display='none'"
              >

            `;
      })
      .join("");
  }

  const name = escapeHTML(doc.nama || "");

  const description = escapeHTML(doc.deskripsi || "-");

  const id = escapeJS(String(doc.id || ""));

  let imageHTML;

  if (imageUrl) {
    imageHTML = `

      <img
        class="card-image"
        src="${escapeAttribute(imageUrl)}"
        alt="${name}"
        onclick="openLightbox('${escapeJS(imageUrl)}')"
        onerror="handleImageError(this)"
      >

    `;
  } else {
    imageHTML = `

      <div class="card-image-placeholder">
        🖼️
      </div>

    `;
  }

  let pdfButtons = "";

  if (doc.pdfUrl) {
    const pdf = escapeJS(doc.pdfUrl);

    const safeName = escapeJS(doc.nama || "Dokumen");

    pdfButtons = `

      <button
        type="button"
        class="btn pdf"
        onclick="openPdf('${pdf}')"
      >
        📄 Buka PDF
      </button>


      <button
        type="button"
        class="btn download"
        onclick="downloadPDF('${pdf}','${safeName}')"
      >
        ⬇ Download
      </button>

    `;
  }

  card.innerHTML = `

    ${imageHTML}


    <div class="card-body">


      <h3 class="card-name">
        ${name}
      </h3>


      <p class="card-description">
        ${description}
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

        ${pdfButtons}


        <button
          type="button"
          class="btn edit"
          onclick="openEditModal('${id}')"
        >
          ✏ Edit
        </button>


        <button
          type="button"
          class="btn danger"
          onclick="deleteDocumentConfirm('${id}')"
        >
          🗑 Hapus
        </button>

      </div>


    </div>

  `;

  return card;
}

/* =====================================================
   DRIVE IMAGE URL
===================================================== */

function convertDriveImageUrl(url) {
  if (!url) {
    return "";
  }

  const value = String(url);

  /*
   * Format:
   * https://drive.google.com/file/d/FILE_ID/view
   */

  const match = value.match(/\/d\/([^/]+)/);

  if (match) {
    return (
      "https://drive.google.com/thumbnail?id=" +
      encodeURIComponent(match[1]) +
      "&sz=w1200"
    );
  }

  /*
   * Jika sudah URL gambar biasa.
   */

  return value;
}

/* =====================================================
   IMAGE ERROR
===================================================== */

function handleImageError(image) {
  image.style.display = "none";

  const parent = image.parentElement;

  if (parent && !parent.querySelector(".image-error")) {
    const error = document.createElement("div");

    error.className = "image-error";

    error.textContent = "Gambar gagal dimuat";

    error.style.cssText = `
      height:230px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#f3f4f6;
      color:#9ca3af;
    `;

    parent.insertBefore(error, image);
  }
}

/* =====================================================
   OPEN PDF
===================================================== */

function openPdf(url) {
  if (!url) {
    showToast("File PDF tidak tersedia.", "error");

    return;
  }

  window.open(url, "_blank", "noopener");
}

/* =====================================================
   DOWNLOAD PDF
===================================================== */

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

/* =====================================================
   CREATE MODAL
===================================================== */

function openCreateModal() {
  editMode = false;

  const title = document.getElementById("modalTitle");

  if (title) {
    title.textContent = "Tambah Dokumen";
  }

  const form = document.getElementById("documentForm");

  if (form) {
    form.reset();
  }

  document.getElementById("documentId").value = "";

  document.getElementById("replaceExtraContainer").style.display = "none";

  document.getElementById("pdfRequired").style.display = "inline";

  document.getElementById("mainImageRequired").style.display = "inline";

  document.getElementById("submitButton").textContent = "Simpan";

  showModal();
}

/* =====================================================
   EDIT MODAL
===================================================== */

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

  /*
   * Saat edit,
   * file tidak wajib.
   */

  document.getElementById("pdfRequired").style.display = "none";

  document.getElementById("mainImageRequired").style.display = "none";

  document.getElementById("submitButton").textContent = "Simpan Perubahan";

  showModal();
}

/* =====================================================
   SHOW MODAL
===================================================== */

function showModal() {
  document.getElementById("modal").classList.add("show");
}

/* =====================================================
   CLOSE MODAL
===================================================== */

function closeModal() {
  document.getElementById("modal").classList.remove("show");
}

/* =====================================================
   SUBMIT FORM
===================================================== */

async function submitForm(event) {
  event.preventDefault();

  const name = document.getElementById("documentName").value.trim();

  const description = document.getElementById("description").value.trim();

  if (!name) {
    showToast("Nama dokumen wajib diisi.", "error");

    return;
  }

  try {
    showLoading(editMode ? "Menyimpan perubahan..." : "Mengupload dokumen...");

    /*
     * PDF
     */

    const pdfFile = document.getElementById("pdfFile").files[0];

    /*
     * Gambar utama
     */

    const mainImageFile = document.getElementById("mainImageFile").files[0];

    /*
     * Gambar tambahan
     */

    const extraFiles = document.getElementById("extraImageFiles").files;

    /*
     * Validasi CREATE
     */

    if (!editMode) {
      if (!pdfFile) {
        throw new Error("File PDF wajib dipilih.");
      }

      if (!mainImageFile) {
        throw new Error("Gambar utama wajib dipilih.");
      }
    }

    /*
     * Convert PDF
     */

    const pdf = await fileToObject(pdfFile);

    /*
     * Convert gambar utama
     */

    const mainImage = await fileToObject(mainImageFile);

    /*
     * Convert gambar tambahan
     */

    const extraImages = [];

    for (let i = 0; i < extraFiles.length; i++) {
      const file = extraFiles[i];

      const converted = await fileToObject(file);

      extraImages.push(converted);
    }

    /*
     * Payload
     */

    const payload = {
      id: document.getElementById("documentId").value,

      nama: name,

      deskripsi: description,

      pdf: pdf,

      gambarUtama: mainImage,

      gambarTambahan: extraImages,

      replaceExtraImages: document.getElementById("replaceExtraImages").checked,
    };

    let result;

    /*
     * CREATE
     */

    if (!editMode) {
      result = await apiRequest("createDocument", payload);
    } else {
      /*
       * UPDATE
       */
      result = await apiRequest("updateDocument", payload);
    }

    closeModal();

    showToast(
      result && result.message ? result.message : "Data berhasil disimpan.",
      "success",
    );

    await loadDocuments();
  } catch (error) {
    console.error(error);

    showToast(getErrorMessage(error), "error");
  } finally {
    hideLoading();
  }
}

/* =====================================================
   FILE TO OBJECT
===================================================== */

function fileToObject(file) {
  return new Promise(function (resolve, reject) {
    if (!file) {
      resolve(null);

      return;
    }

    /*
     * Maksimal 20 MB
     */

    if (file.size > 20 * 1024 * 1024) {
      reject(new Error("Ukuran file maksimal 20 MB: " + file.name));

      return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
      const result = event.target.result;

      const parts = result.split(",");

      const base64 = parts.length > 1 ? parts[1] : "";

      resolve({
        name: file.name,

        mimeType: file.type,

        size: file.size,

        data: base64,
      });
    };

    reader.onerror = function () {
      reject(new Error("Gagal membaca file: " + file.name));
    };

    reader.readAsDataURL(file);
  });
}

/* =====================================================
   DELETE CONFIRM
===================================================== */

async function deleteDocumentConfirm(id) {
  const doc = documents.find(function (item) {
    return String(item.id) === String(id);
  });

  if (!doc) {
    showToast("Dokumen tidak ditemukan.", "error");

    return;
  }

  const confirmed = window.confirm(
    'Hapus dokumen "' +
      doc.nama +
      '"?\n\n' +
      "Data Spreadsheet akan dihapus dan folder dokumen di Google Drive akan dipindahkan ke Sampah.",
  );

  if (!confirmed) {
    return;
  }

  try {
    showLoading("Menghapus dokumen...");

    const result = await apiRequest("deleteDocument", null, id);

    showToast(
      result && result.message ? result.message : "Dokumen berhasil dihapus.",
      "success",
    );

    await loadDocuments();
  } catch (error) {
    console.error(error);

    showToast(getErrorMessage(error), "error");
  } finally {
    hideLoading();
  }
}

/* =====================================================
   LIGHTBOX
===================================================== */

function openLightbox(url) {
  if (!url) {
    return;
  }

  const lightbox = document.getElementById("lightbox");

  const image = document.getElementById("lightboxImage");

  image.src = url;

  lightbox.classList.add("show");

  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const lightbox = document.getElementById("lightbox");

  const image = document.getElementById("lightboxImage");

  lightbox.classList.remove("show");

  image.src = "";

  document.body.style.overflow = "";
}

/* =====================================================
   TOAST
===================================================== */

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;

  toast.className = "toast show";

  if (type === "error") {
    toast.classList.add("error");
  }

  clearTimeout(toastTimer);

  toastTimer = setTimeout(function () {
    toast.classList.remove("show");
  }, 4000);
}

/* =====================================================
   LOADING
===================================================== */

function showLoading(message) {
  const loading = document.getElementById("loading");

  const loadingText = document.getElementById("loadingText");

  if (loadingText) {
    loadingText.textContent = message || "Memproses...";
  }

  if (loading) {
    loading.classList.add("show");
  }
}

function hideLoading() {
  const loading = document.getElementById("loading");

  if (loading) {
    loading.classList.remove("show");
  }
}

/* =====================================================
   ERROR MESSAGE
===================================================== */

function getErrorMessage(error) {
  if (!error) {
    return "Terjadi kesalahan.";
  }

  if (typeof error === "string") {
    return error;
  }

  return error.message || "Terjadi kesalahan.";
}

/* =====================================================
   SANITIZE DOWNLOAD NAME
===================================================== */

function sanitizeDownloadName(name) {
  return String(name || "dokumen")
    .replace(/[\\/:*?"<>|]/g, "")

    .trim();
}

/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");
}

/* =====================================================
   ESCAPE ATTRIBUTE
===================================================== */

function escapeAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")

    .replace(/"/g, "&quot;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;");
}

/* =====================================================
   ESCAPE JAVASCRIPT STRING
===================================================== */

function escapeJS(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")

    .replace(/'/g, "\\'")

    .replace(/"/g, '\\"')

    .replace(/\r/g, "\\r")

    .replace(/\n/g, "\\n")

    .replace(/</g, "\\x3C")

    .replace(/>/g, "\\x3E");
}

/* =====================================================
   ESCAPE KEY
===================================================== */

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeModal();

    closeLightbox();
  }
});

/* =====================================================
   CLICK OUTSIDE MODAL
===================================================== */

document.getElementById("modal")?.addEventListener("click", function (event) {
  if (event.target === this) {
    closeModal();
  }
});

/* =====================================================
   CLICK OUTSIDE LIGHTBOX
===================================================== */

document
  .getElementById("lightbox")
  ?.addEventListener("click", function (event) {
    if (event.target === this) {
      closeLightbox();
    }
  });
