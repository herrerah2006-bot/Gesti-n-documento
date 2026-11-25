const GOOGLE_API_KEY = "AIzaSyByZSeffuMjgI2kLaQGVQrQHzOFhxUau2A";
const GOOGLE_CLIENT_ID = "277525506274-qhiqvljni090rt2hkr9hg1810m02g3rv.apps.googleusercontent.com";
const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email";
const CUENTA_DRIVE_PERMITIDA = "ygx890@gmail.com";

let googleAccessToken = null;
let tokenClient = null;
let gsiCargado = false;

let carpetaActualId = "root";
let historialCarpetas = [];
let seleccionadosModal = new Map();

function crearTokenClient() {
    if (!window.google || !google.accounts) return false;

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPES,
        callback: async (resp) => {
            if (resp.error || !resp.access_token) {
                alert("Error de autenticación con Google Drive.");
                return;
            }

            const correoAutorizado = await validarCuentaDrivePermitida(resp.access_token);
            if (!correoAutorizado) {
                googleAccessToken = null;
                alert(`Acceso denegado: solo se permite la cuenta de Drive ${CUENTA_DRIVE_PERMITIDA}.`);
                return;
            }

            googleAccessToken = resp.access_token;
            abrirSelectorDrive();
        }
    });

    gsiCargado = true;
    return true;
}

async function validarCuentaDrivePermitida(token) {
    try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return false;
        const perfil = await res.json();
        const correo = (perfil.email || "").trim().toLowerCase();
        return correo === CUENTA_DRIVE_PERMITIDA.toLowerCase();
    } catch (e) {
        console.error("Error verificando cuenta de Google:", e);
        return false;
    }
}

window.addEventListener("load", () => {
    crearTokenClient();
});

function iniciarImportacionDrive() {
    if (!tokenClient) {
        crearTokenClient();
    }

    if (!gsiCargado || !tokenClient) {
        alert("Los servicios de Google aún están cargando. Intenta en unos segundos.");
        return;
    }

    if (!googleAccessToken) {
        tokenClient.requestAccessToken({
            prompt: "",
            login_hint: CUENTA_DRIVE_PERMITIDA
        });
    } else {
        abrirSelectorDrive();
    }
}

function abrirSelectorDrive() {
    carpetaActualId = "root";
    historialCarpetas = [];
    seleccionadosModal.clear();

    let modal = document.getElementById("modalDrivePersonalizado");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "modalDrivePersonalizado";
        modal.className = "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4";
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden text-xs">
                <div class="flex items-center justify-between px-4 py-2.5 border-b bg-slate-50">
                    <div>
                        <div class="font-bold text-slate-800 text-sm">Google Drive (PDFs y Carpetas)</div>
                        <div id="rutaCarpetaDrive" class="text-[11px] text-gray-500">Mi unidad — ${CUENTA_DRIVE_PERMITIDA}</div>
                    </div>
                    <button id="cerrarModalDrive" type="button" class="text-gray-400 hover:text-gray-700 text-sm cursor-pointer">✕</button>
                </div>
                <div class="px-4 py-2 border-b flex items-center justify-between bg-white">
                    <button id="btnVolverCarpetaDrive" type="button" class="text-blue-600 hover:underline disabled:opacity-40 cursor-pointer" disabled>
                        &lt; Volver atrás
                    </button>
                    <span id="contadorSeleccionDrive" class="text-gray-600">0 seleccionados</span>
                </div>
                <div id="listaItemsDrive" class="max-h-72 overflow-y-auto divide-y divide-gray-100"></div>
                <div class="px-4 py-2.5 border-t bg-slate-50 flex justify-end gap-2">
                    <button id="btnCancelarDrive" type="button" class="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 cursor-pointer">
                        Cancelar
                    </button>
                    <button id="btnConfirmarDrive" type="button" class="px-3 py-1.5 rounded bg-blue-600 text-white font-semibold hover:bg-blue-500 cursor-pointer">
                        Importar seleccionados
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById("cerrarModalDrive").onclick = cerrarModalDrive;
        document.getElementById("btnCancelarDrive").onclick = cerrarModalDrive;
        document.getElementById("btnVolverCarpetaDrive").onclick = volverCarpetaDrive;
        document.getElementById("btnConfirmarDrive").onclick = importarSeleccionModalDrive;
    }

    modal.classList.remove("hidden");
    cargarContenidoCarpetaDrive(carpetaActualId, "Mi unidad");
}

function cerrarModalDrive() {
    const modal = document.getElementById("modalDrivePersonalizado");
    if (modal) modal.classList.add("hidden");
}

async function cargarContenidoCarpetaDrive(folderId, nombreCarpeta) {
    carpetaActualId = folderId;
    document.getElementById("rutaCarpetaDrive").textContent = `${nombreCarpeta} (${CUENTA_DRIVE_PERMITIDA})`;
    document.getElementById("btnVolverCarpetaDrive").disabled = historialCarpetas.length === 0;

    const contenedor = document.getElementById("listaItemsDrive");
    contenedor.innerHTML = `<div class="p-4 text-center text-gray-500">Cargando elementos de Drive...</div>`;

    const q = encodeURIComponent(
        `'${folderId}' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.folder' or mimeType = 'application/pdf')`
    );
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&orderBy=folder,name&pageSize=100`;

    const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
    });

    if (!resp.ok) {
        contenedor.innerHTML = `<div class="p-4 text-center text-red-600">No se pudo leer Google Drive.</div>`;
        return;
    }

    const data = await resp.json();
    const items = data.files || [];

    if (items.length === 0) {
        contenedor.innerHTML = `<div class="p-6 text-center text-gray-400">No hay carpetas ni PDFs aquí.</div>`;
        return;
    }

    contenedor.innerHTML = "";
    items.forEach(item => {
        const esCarpeta = item.mimeType === "application/vnd.google-apps.folder";
        const fila = document.createElement("div");
        fila.className = "flex items-center justify-between px-4 py-2 hover:bg-slate-50 gap-2";

        const izq = document.createElement("div");
        izq.className = "flex items-center gap-2 min-w-0 flex-1";

        const check = document.createElement("input");
        check.type = "checkbox";
        check.checked = seleccionadosModal.has(item.id);
        check.className = "cursor-pointer";
        check.onchange = () => {
            if (check.checked) {
                seleccionadosModal.set(item.id, item);
            } else {
                seleccionadosModal.delete(item.id);
            }
            actualizarContadorDrive();
        };

        const nombre = document.createElement("span");
        nombre.className = "truncate text-slate-800";
        nombre.textContent = `${esCarpeta ? "📁" : "📄"} ${item.name}`;

        izq.appendChild(check);
        izq.appendChild(nombre);
        fila.appendChild(izq);

        if (esCarpeta) {
            const btnAbrir = document.createElement("button");
            btnAbrir.type = "button";
            btnAbrir.className = "text-blue-600 hover:underline text-[11px] shrink-0 cursor-pointer";
            btnAbrir.textContent = "Abrir →";
            btnAbrir.onclick = () => {
                historialCarpetas.push({
                    id: carpetaActualId,
                    nombre: nombreCarpeta
                });
                cargarContenidoCarpetaDrive(item.id, `${nombreCarpeta} / ${item.name}`);
            };
            fila.appendChild(btnAbrir);
        }

        contenedor.appendChild(fila);
    });

    actualizarContadorDrive();
}

function volverCarpetaDrive() {
    const anterior = historialCarpetas.pop();
    if (anterior) {
        cargarContenidoCarpetaDrive(anterior.id, anterior.nombre);
    }
}

function actualizarContadorDrive() {
    const el = document.getElementById("contadorSeleccionDrive");
    if (el) el.textContent = `${seleccionadosModal.size} seleccionados`;
}

async function importarSeleccionModalDrive() {
    const seleccionados = Array.from(seleccionadosModal.values());
    if (seleccionados.length === 0) {
        alert("Selecciona al menos un PDF o carpeta.");
        return;
    }

    cerrarModalDrive();
    const listaFinalPdfs = [];

    for (const item of seleccionados) {
        if (item.mimeType === "application/vnd.google-apps.folder") {
            const pdfsCarpeta = await listarPdfsEnCarpeta(item.id);
            listaFinalPdfs.push(...pdfsCarpeta);
        } else if (item.mimeType === "application/pdf") {
            listaFinalPdfs.push({ id: item.id, name: item.name });
        }
    }

    if (listaFinalPdfs.length === 0) {
        alert("No se encontraron archivos PDF dentro de la selección.");
        return;
    }

    const archivosConvertidos = [];
    for (const pdfMeta of listaFinalPdfs) {
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${pdfMeta.id}?alt=media`, {
            headers: { Authorization: `Bearer ${googleAccessToken}` }
        });
        if (!resp.ok) continue;
        const blob = await resp.blob();
        archivosConvertidos.push(new File([blob], pdfMeta.name, { type: "application/pdf" }));
        await new Promise(r => setTimeout(r, 30));
    }

    const inputLocal = document.getElementById("inputArchivoPdf");
    if (inputLocal && archivosConvertidos.length > 0) {
        const dt = new DataTransfer();
        archivosConvertidos.forEach(f => dt.items.add(f));
        inputLocal.files = dt.files;
        inputLocal.dispatchEvent(new Event("change", { bubbles: true }));
    }
}

async function listarPdfsEnCarpeta(folderId) {
    const query = encodeURIComponent(`'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=100`;
    const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    return json.files || [];
}