document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.getElementById("tablaBusquedaBody");
    const inputFolio = document.getElementById("buscarFolio");
    const inputCliente = document.getElementById("buscarCliente");
    const inputDistribuidor = document.getElementById("buscarDistribuidor");
    const btnLimpiar = document.getElementById("btnLimpiarBusqueda");

    if (!tbody) return;

    const INTERVALO_MS = 5000;
    // Ajusta estas rutas GET si tu ServidorWeb usa otro endpoint para listar contratos/documentos
    const RUTAS_GET_CONTRATOS = [
        "/api/contratos",
        "/api/documentos",
        "/api/indexamiento"
    ];

    let cacheRegistros = JSON.parse(localStorage.getItem("contratos_indexados")) || [];
    let ultimaFirmaDatos = JSON.stringify(cacheRegistros);
    let consultando = false;

    function obtenerUrlBaseBackend() {
        if (window.location.protocol === "http:" || window.location.protocol === "https:") {
            return window.location.origin;
        }
        return "http://192.168.169.27:8080";
    }

    function extraerListaDesdeRespuesta(data) {
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.contratos)) return data.contratos;
        if (data && Array.isArray(data.documentos)) return data.documentos;
        if (data && Array.isArray(data.datos)) return data.datos;
        if (data && Array.isArray(data.data)) return data.data;
        return null;
    }

    async function consultarRegistrosDesdeServidor() {
        const baseUrl = obtenerUrlBaseBackend();

        for (const ruta of RUTAS_GET_CONTRATOS) {
            try {
                const resp = await fetch(`${baseUrl}${ruta}`, {
                    method: "GET",
                    headers: { "Accept": "application/json" },
                    cache: "no-store"
                });

                if (resp.ok) {
                    const data = await resp.json();
                    const lista = extraerListaDesdeRespuesta(data);
                    if (lista) {
                        cacheRegistros = lista;
                        localStorage.setItem("contratos_indexados", JSON.stringify(lista));
                        return lista;
                    }
                }
            } catch (_) {
                // Intenta la siguiente ruta candidata o cae al respaldo local
            }
        }

        cacheRegistros = JSON.parse(localStorage.getItem("contratos_indexados")) || [];
        return cacheRegistros;
    }

    function obtenerTodosLosRegistros() {
        return cacheRegistros;
    }

    function renderizarBusqueda(lista) {
        tbody.innerHTML = "";

        if (!lista || lista.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-4 text-center text-gray-500">No se encontraron contratos con esos criterios.</td>
                </tr>
            `;
            return;
        }

        lista.forEach((item) => {
            const fila = document.createElement("tr");
            fila.className = "border-b border-gray-200 hover:bg-gray-50 text-center";

            const folioStr = item.nroContrato || item.folio || "";
            const clienteStr = item.nombreCliente || item.cliente || "";
            const distribuidorStr = item.nroDistribuidor || item.distribuidor || "";
            const empresaStr = item.nombreEmpresa || item.empresa || "";
            const observacionesStr = item.observaciones || item.obsHojas || "";

            fila.innerHTML = `
                <td class="p-2 border-r">${item.fechaProceso || ""}</td>
                <td class="p-2 border-r">${item.fechaContrato || ""}</td>
                <td class="p-2 border-r">${distribuidorStr}</td>
                <td class="p-2 border-r font-semibold text-indigo-700">${folioStr}</td>
                <td class="p-2 border-r">${clienteStr}</td>
                <td class="p-2 border-r">${empresaStr}</td>
                <td class="p-2">${observacionesStr}</td>
            `;
            tbody.appendChild(fila);
        });
    }

    function filtrarRegistros(listaFuente = obtenerTodosLosRegistros()) {
        const textoFolio = (inputFolio?.value || "").toLowerCase().trim();
        const textoCliente = (inputCliente?.value || "").toLowerCase().trim();
        const textoDist = (inputDistribuidor?.value || "").toLowerCase().trim();

        const filtrados = listaFuente.filter((item) => {
            const f = (item.nroContrato || item.folio || "").toLowerCase();
            const c = (item.nombreCliente || item.cliente || "").toLowerCase();
            const d = (item.nroDistribuidor || item.distribuidor || "").toLowerCase();

            return f.includes(textoFolio) && c.includes(textoCliente) && d.includes(textoDist);
        });

        renderizarBusqueda(filtrados);
    }

    function usuarioEstaEscribiendo() {
        const activo = document.activeElement;
        return activo && (
            activo === inputFolio ||
            activo === inputCliente ||
            activo === inputDistribuidor ||
            activo.tagName === "INPUT" ||
            activo.tagName === "TEXTAREA"
        );
    }

    function asegurarBotonActualizar() {
        let btn = document.getElementById("btnActualizarInformacion") || document.getElementById("btnActualizar");

        if (!btn) {
            btn = document.createElement("button");
            btn.type = "button";
            btn.id = "btnActualizarInformacion";
            btn.textContent = "Actualizar información";
            btn.className = "px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-sm cursor-pointer";

            if (btnLimpiar && btnLimpiar.parentElement) {
                btnLimpiar.parentElement.insertBefore(btn, btnLimpiar);
            } else {
                const tabla = tbody.closest("table");
                if (tabla && tabla.parentElement) {
                    tabla.parentElement.insertBefore(btn, tabla);
                }
            }
        }

        return btn;
    }

    const btnActualizar = asegurarBotonActualizar();

    async function sincronizarInformacion({ forzarRender = false, silencioso = false } = {}) {
        if (consultando) return;
        consultando = true;

        const textoOriginal = btnActualizar ? btnActualizar.textContent : "Actualizar información";
        if (btnActualizar && !silencioso) {
            btnActualizar.disabled = true;
            btnActualizar.textContent = "Actualizando...";
        }

        try {
            const registros = await consultarRegistrosDesdeServidor();
            const nuevaFirma = JSON.stringify(registros);
            const hayCambios = nuevaFirma !== ultimaFirmaDatos;

            if (hayCambios) {
                ultimaFirmaDatos = nuevaFirma;
            }

            if (forzarRender || (hayCambios && !usuarioEstaEscribiendo())) {
                filtrarRegistros(registros);
            }
        } finally {
            consultando = false;
            if (btnActualizar && !silencioso) {
                btnActualizar.disabled = false;
                btnActualizar.textContent = textoOriginal;
            }
        }
    }

    if (inputFolio) inputFolio.addEventListener("input", () => filtrarRegistros());
    if (inputCliente) inputCliente.addEventListener("input", () => filtrarRegistros());
    if (inputDistribuidor) inputDistribuidor.addEventListener("input", () => filtrarRegistros());

    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", () => {
            if (inputFolio) inputFolio.value = "";
            if (inputCliente) inputCliente.value = "";
            if (inputDistribuidor) inputDistribuidor.value = "";
            filtrarRegistros(obtenerTodosLosRegistros());
        });
    }

    if (btnActualizar) {
        btnActualizar.addEventListener("click", () => {
            sincronizarInformacion({ forzarRender: true, silencioso: false });
        });
    }

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            sincronizarInformacion({ forzarRender: false, silencioso: true });
        }
    });

    // Carga inicial inmediata + consulta automática cada 5 segundos
    filtrarRegistros(cacheRegistros);
    sincronizarInformacion({ forzarRender: true, silencioso: true });
    setInterval(() => {
        sincronizarInformacion({ forzarRender: false, silencioso: true });
    }, INTERVALO_MS);
});