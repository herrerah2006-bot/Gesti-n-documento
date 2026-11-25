let paginaActual = 1;
const totalPaginas = 6;
let listaDeArchivos = [];
let ultimoNombreArchivo = "";

function obtenerUrlBaseBackend() {
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
        return window.location.origin;
    }
    return "http://192.168.168.64:8080";
}

function obtenerClaveUsuarioActual() {
    try {
        const s = JSON.parse(localStorage.getItem("sesion_usuario"));
        const user = (s && (s.user || s.usuario)) ? String(s.user || s.usuario).trim().toLowerCase() : "invitado";
        return user.replace(/[^a-z0-9_-]/g, "_");
    } catch {
        return "invitado";
    }
}

function claveSesionArchivos() {
    return `lista_de_archivos_sesion_${obtenerClaveUsuarioActual()}`;
}

function claveBorradorInput(inputId) {
    return `borrador_${obtenerClaveUsuarioActual()}_${inputId}`;
}

function guardarListaArchivosSegura() {
    try {
        // Guardamos en localStorage solo entradas ligeras para no exceder cuota con PDFs de 25+ hojas
        const versionLigera = listaDeArchivos.map(doc => {
            if (doc.url && doc.url.startsWith("data:") && doc.url.length > 1500000) {
                return { nombre: doc.nombre, url: null, esPesado: true };
            }
            if (doc.url && doc.url.startsWith("blob:")) {
                return { nombre: doc.nombre, url: null, esPesado: true };
            }
            return doc;
        });
        localStorage.setItem(claveSesionArchivos(), JSON.stringify(versionLigera));
    } catch (e) {
        console.warn("No se pudo persistir toda la cola en localStorage por tamaño:", e);
    }
}

document.addEventListener("DOMContentLoaded", () => {

    let contadorSiActual = localStorage.getItem('contadorGlobalSi');
    if (contadorSiActual === null || isNaN(contadorSiActual) || parseInt(contadorSiActual) > 10000) {
        contadorSiActual = 0;
        localStorage.setItem('contadorGlobalSi', 0);
    }

    const spanSi = document.getElementById("contadorSi");
    if (spanSi) {
        spanSi.innerText = contadorSiActual;
    }


    const archivosGuardados = localStorage.getItem(claveSesionArchivos());
    if (archivosGuardados) {
        try {
            listaDeArchivos = JSON.parse(archivosGuardados);
        } catch (e) {
            listaDeArchivos = [];
        }
    }


    const inputsForm = document.querySelectorAll("#formIndexacion input, #formIndexacion textarea, input[id*='fecha'], input[id*='nro'], input[id*='nombre'], input[id*='observaciones'], input[id*='codigo'], input[id*='area']");
    inputsForm.forEach(input => {
        if (!input.id) return;
        const claveBorrador = claveBorradorInput(input.id);
        const valorGuardado = localStorage.getItem(claveBorrador);
        if (valorGuardado) {
            input.value = valorGuardado;
        }
        input.addEventListener("input", () => {
            try {
                localStorage.setItem(claveBorrador, input.value);
            } catch (e) {
                console.warn("No se pudo guardar borrador:", e);
            }
        });
    });

    actualizarListaDocumentos();
    window.listaDeArchivos = listaDeArchivos;
    window.actualizarListaDocumentos = actualizarListaDocumentos;


    const btnIndexadoSup = document.getElementById("btnIndexadoSuperior");
    const btnIndexadoPan = document.getElementById("btnIndexadoPanel");

    [btnIndexadoSup, btnIndexadoPan].forEach(el => {
        if (el) {
            el.addEventListener("click", () => {

                if (listaDeArchivos.length === 0) {
                    alert("⚠ Error: No hay documentos pendientes. Debe importar un documento primero.");
                    return;
                }


                const fechaProceso = document.getElementById('fechaProceso')?.value.trim() || new Date().toISOString().split('T')[0];
                const fechaContrato = document.getElementById('fechaContrato')?.value.trim() || "";
                const nroDistribuidor = document.getElementById('nroDistribuidor')?.value.trim() || "";
                const nroContrato = document.getElementById('nroContrato')?.value.trim() || "";
                const nombreCliente = document.getElementById('nombreCliente')?.value.trim() || "";
                const observaciones = document.getElementById('observaciones')?.value.trim() || document.getElementById('obsHojas')?.value.trim() || "";
                const nombreEmpresa = document.getElementById('nombreEmpresa')?.value.trim() || "";
                const codigoEmpresa = document.getElementById('codigoEmpresa')?.value.trim() || "";
                const areaEmpresa = document.getElementById('areaEmpresa')?.value.trim() || "";


                if (!fechaContrato || !nroDistribuidor || !nroContrato || !nombreCliente || !nombreEmpresa || !codigoEmpresa || !areaEmpresa) {
                    alert("⚠ Error: Todos los apartados y campos de la metadata deben estar llenos antes de indexar el contrato.");
                    return;
                }

                const nombreArchivoGenerado = `${nroContrato}_${nombreCliente}.pdf`;
                ultimoNombreArchivo = nombreArchivoGenerado;


                if (listaDeArchivos.length > 0) {
                    try {
                        const docActual = listaDeArchivos[0];
                        if (docActual.url) {
                            const linkDescarga = document.createElement('a');
                            linkDescarga.href = docActual.url;
                            linkDescarga.download = nombreArchivoGenerado;
                            document.body.appendChild(linkDescarga);
                            linkDescarga.click();
                            document.body.removeChild(linkDescarga);
                        }
                    } catch (err) {
                        console.error("Error al descargar el PDF:", err);
                    }
                }


                guardarMetadataEnServidor(nombreArchivoGenerado);


                incrementarContadorSi();

                const ahora = new Date();
                const horas = String(ahora.getHours()).padStart(2, '0');
                const minutos = String(ahora.getMinutes()).padStart(2, '0');
                const horaActualStr = `${horas}:${minutos}`;

                const datosContrato = {
                    fechaProceso,
                    fechaContrato,
                    nroDistribuidor,
                    nroContrato,
                    nombreCliente,
                    observaciones,
                    nombreEmpresa,
                    codigoEmpresa,
                    areaEmpresa,
                    fechaRegistro: ahora.toLocaleString(),
                    horaRegistro: horaActualStr

                };

                let registrosGuardados = JSON.parse(localStorage.getItem("contratos_indexados")) || [];
                registrosGuardados.push(datosContrato);
                localStorage.setItem("contratos_indexados", JSON.stringify(registrosGuardados));


                let hoy = new Date();
                let dia = String(hoy.getDate()).padStart(2, '0');
                let mes = String(hoy.getMonth() + 1).padStart(2, '0');
                let anio = hoy.getFullYear();
                let fechaActualStr = `${dia}/${mes}/${anio}`;

                let controlTiempos = JSON.parse(localStorage.getItem("control_tiempos")) || [];
                let registroHoy = controlTiempos.find(c => c.fechaTurno && c.fechaTurno.includes(fechaActualStr));

                if (registroHoy) {
                    registroHoy.totalContratos = (registroHoy.totalContratos || 0) + 1;
                    registroHoy.cantidadFolios = registroHoy.totalContratos;
                } else {
                    controlTiempos.push({
                        fechaTurno: fechaActualStr + " - PM",
                        turno: "PM",
                        totalContratos: 1,
                        cantidadFolios: 1
                    });
                }
                localStorage.setItem("control_tiempos", JSON.stringify(controlTiempos));

                const corteActual = registroHoy || controlTiempos[controlTiempos.length - 1];
                guardarControlTiemposEnServidor(fechaActualStr, corteActual);


                const eliminado = listaDeArchivos.shift();
                if (eliminado && eliminado.url && eliminado.url.startsWith("blob:")) {
                    URL.revokeObjectURL(eliminado.url);
                }
                guardarListaArchivosSegura();
                actualizarListaDocumentos();
                limpiarBorradorFormulario();


                const inputsForm = document.querySelectorAll("#formIndexacion input, #formIndexacion textarea");
                inputsForm.forEach(input => { input.value = ""; });

                alert("✔ ¡Contrato indexado, PDF descargado a la PC y enviado a MySQL con éxito!");
            });
        }
    });


    const inputArchivoPdf = document.getElementById("inputArchivoPdf");

    if (inputArchivoPdf) {
        inputArchivoPdf.addEventListener("change", (e) => {
            const archivos = Array.from(e.target.files || []);
            if (archivos.length === 0) return;

            let ultimoDocAgregado = null;

            archivos.forEach((archivo) => {
                // Para archivos mayores a 2 MB usamos Blob URL en vez de Base64 para evitar bloqueos y fallos en PDFs de 25+ hojas
                if (archivo.size > 2 * 1024 * 1024) {
                    const blobUrl = URL.createObjectURL(archivo);
                    const nuevoDoc = { nombre: archivo.name, url: blobUrl };
                    listaDeArchivos.push(nuevoDoc);
                    ultimoDocAgregado = nuevoDoc;
                    guardarListaArchivosSegura();
                    actualizarListaDocumentos();
                } else {
                    const lector = new FileReader();
                    lector.onload = function (evento) {
                        const base64Data = evento.target.result;
                        const nuevoDoc = { nombre: archivo.name, url: base64Data };
                        listaDeArchivos.push(nuevoDoc);
                        ultimoDocAgregado = nuevoDoc;
                        guardarListaArchivosSegura();
                        actualizarListaDocumentos();
                        mostrarEnVisor(nuevoDoc);
                    };
                    lector.readAsDataURL(archivo);
                }
            });

            if (ultimoDocAgregado && ultimoDocAgregado.url && ultimoDocAgregado.url.startsWith("blob:")) {
                mostrarEnVisor(ultimoDocAgregado);
            }

            if (typeof window.actualizarBarraCargaVisor === "function") {
                setTimeout(() => window.actualizarBarraCargaVisor(0, false), 300);
            }
        });
    }


    const btnGuardar = document.getElementById("btnGuardar");
    if (btnGuardar) {
        btnGuardar.addEventListener("click", guardarMetadataEnServidor);
    }


    const btnAnterior = document.getElementById("btnAnterior");
    const btnSiguiente = document.getElementById("btnSiguiente");

    if (btnAnterior && btnSiguiente) {
        btnAnterior.addEventListener("click", () => {
            if (paginaActual > 1) {
                paginaActual--;
                actualizarVisorPagina();
            }
        });

        btnSiguiente.addEventListener("click", () => {
            if (paginaActual < totalPaginas) {
                paginaActual++;
                actualizarVisorPagina();
            }
        });
    }


    if (listaDeArchivos.length > 0 && listaDeArchivos[0].url) {
        mostrarEnVisor(listaDeArchivos[0]);
    }
});


function incrementarContadorSi() {
    let contadorSiActual = localStorage.getItem('contadorGlobalSi');
    if (contadorSiActual === null || isNaN(contadorSiActual)) {
        contadorSiActual = 0;
    } else {
        contadorSiActual = parseInt(contadorSiActual) + 1;
    }
    localStorage.setItem('contadorGlobalSi', contadorSiActual);

    const spanSi = document.getElementById("contadorSi");
    if (spanSi) {
        spanSi.innerText = contadorSiActual;
    }
}


function actualizarListaDocumentos() {
    const contenedor = document.getElementById("listaDocumentos");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    const contadorNoEl = document.getElementById("contadorNo");
    if (contadorNoEl) {
        contadorNoEl.innerText = listaDeArchivos.length;
    }

    if (listaDeArchivos.length === 0) {
        const tituloVisor = document.getElementById("nombreDocumentoVisor");
        const lienzoVisor = document.getElementById("contenedorLienzoVisor");
        if (tituloVisor) tituloVisor.innerText = "Seleccione un documento";
        if (lienzoVisor) {
            lienzoVisor.innerHTML = `
                <div class="bg-white shadow-2xl border border-gray-400 p-8 max-w-xl w-full text-center rounded">
                    <div class="border-2 border-dashed border-indigo-300 p-16 rounded bg-indigo-50/50">
                        <p class="text-indigo-900 font-bold mb-1">Sin documento seleccionado</p>
                        <p class="text-xs text-gray-500">Todos los documentos pendientes han sido procesados.</p>
                    </div>
                </div>
            `;
        }
        return;
    }

    listaDeArchivos.forEach((doc, index) => {
        const linkDoc = document.createElement("a");
        linkDoc.href = "#";
        linkDoc.className = `block p-0.5 rounded truncate transition hover:bg-slate-700 cursor-pointer ${index === 0 ? 'bg-slate-800 font-bold text-white' : 'opacity-80 text-blue-300'
            }`;
        linkDoc.innerHTML = `📄 ${doc.nombre}`;

        linkDoc.addEventListener("click", (e) => {
            e.preventDefault();
            const todosLosLinks = contenedor.querySelectorAll("a");
            todosLosLinks.forEach(l => {
                l.classList.remove("bg-slate-800", "font-bold", "text-white");
                l.classList.add("opacity-80", "text-blue-300");
            });

            linkDoc.classList.add("bg-slate-800", "font-bold", "text-white");
            linkDoc.classList.remove("opacity-80", "text-blue-300");

            mostrarEnVisor(doc);
        });

        contenedor.appendChild(linkDoc);
    });
}


function mostrarEnVisor(doc) {
    const tituloVisor = document.getElementById("nombreDocumentoVisor");
    const lienzoVisor = document.getElementById("contenedorLienzoVisor");

    if (tituloVisor) {
        tituloVisor.innerText = doc.nombre;
    }

    if (lienzoVisor) {
        if (doc.url) {
            lienzoVisor.innerHTML = `<iframe src="${doc.url}" class="w-full h-full border-0 rounded"></iframe>`;
        } else {
            lienzoVisor.innerHTML = `
                <div class="bg-white p-8 border rounded shadow-md text-center max-w-md">
                    <p class="font-bold text-slate-800 mb-2">${doc.nombre}</p>
                    <p class="text-xs text-gray-500">Vuelve a importar este archivo si recargaste la página.</p>
                </div>
            `;
        }
    }

    if (typeof window.actualizarBarraCargaVisor === "function") {
        setTimeout(() => window.actualizarBarraCargaVisor(0, false), 250);
    }
}


function actualizarVisorPagina() {
    const indicador = document.getElementById("indicadorPagina");
    if (indicador) {
        indicador.innerText = `${paginaActual} / ${totalPaginas}`;
    }
}


function guardarMetadataEnServidor(nombreArchivoParam = "") {
    const nroContratoActual = document.getElementById('nroContrato')?.value.trim() || '';
    const nombreClienteActual = document.getElementById('nombreCliente')?.value.trim() || '';
    const nombreCalculado = (nroContratoActual && nombreClienteActual)
        ? `${nroContratoActual}_${nombreClienteActual}.pdf`
        : '';

    const archivoFinal = nombreArchivoParam || ultimoNombreArchivo || nombreCalculado || listaDeArchivos[0]?.nombre || 'Sin nombre';

    const data = {
        fechaProceso: document.getElementById('fechaProceso')?.value || '',
        fechaContrato: document.getElementById('fechaContrato')?.value || '',
        nroDistribuidor: document.getElementById('nroDistribuidor')?.value || '',
        nroContrato: document.getElementById('nroContrato')?.value || '',
        nombreCliente: document.getElementById('nombreCliente')?.value || '',
        observaciones: document.getElementById('obsHojas')?.value.trim() || document.getElementById('observaciones')?.value.trim() || '',
        nombreEmpresa: document.getElementById('nombreEmpresa')?.value || '',
        codigoEmpresa: document.getElementById('codigoEmpresa')?.value || '',
        areaEmpresa: document.getElementById('areaEmpresa')?.value || '',
        archivo: archivoFinal
    };

    const baseUrl = obtenerUrlBaseBackend();

    fetch(`${baseUrl}/api/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(response => {

        })
        .catch(err => {
            console.error("Error de conexión:", err);
            alert(`Error: No se pudo conectar con el servidor en ${baseUrl}.`);
        });
}


function guardarControlTiemposEnServidor(fechaStr, corte) {
    const cantidadPm = corte?.totalContratos || 1;
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const dia = String(ahora.getDate()).padStart(2, "0");
    const horas = String(ahora.getHours()).padStart(2, "0");
    const minutos = String(ahora.getMinutes()).padStart(2, "0");
    const segundos = String(ahora.getSeconds()).padStart(2, "0");

    const fechaCreacionSql = `${anio}-${mes}-${dia} ${horas}:${minutos}:${segundos}`;

    const payloadControlTiempos = {
        fechaTurno: fechaStr,
        cantidad1: 1,
        horaInicio1: "10:00 a. m.",
        horaFin1: "11:30 a. m.",
        cantidad2: cantidadPm,
        horaInicio2: "11:00 a. m.",
        horaFin2: "17:00 p. m.",
        horasPorcentaje: "2:00",
        horasPorProceso: "6:00",
        totalHoras: "8:00",
        fechaCreacion: fechaCreacionSql
    };

    const baseUrl = obtenerUrlBaseBackend();

    fetch(`${baseUrl}/api/control-tiempos`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify(payloadControlTiempos)
    })
        .then(res => res.json())
        .then(response => {
            console.log("Control de tiempos en MySQL:", response);
        })
        .catch(err => {
            console.error("Error al enviar control de tiempos:", err);
        });
}


function limpiarBorradorFormulario() {
    const inputsForm = document.querySelectorAll("#formIndexacion input, #formIndexacion textarea, input[id*='fecha'], input[id*='nro'], input[id*='nombre'], input[id*='observaciones'], input[id*='codigo'], input[id*='area']");
    inputsForm.forEach(input => {
        if (!input.id) return;
        localStorage.removeItem(claveBorradorInput(input.id));
        input.value = "";
    });
}

function obtenerSesionRol() {
    try {
        const s = JSON.parse(localStorage.getItem("sesion_usuario"));
        return s && s.rol ? s.rol : null;
    } catch {
        return null;
    }
}

function esAdminActual() {
    return obtenerSesionRol() === "administrador";
}

function registrarHistorialBorrado(tipo, detalle, datos) {
    const sesion = JSON.parse(localStorage.getItem("sesion_usuario")) || {};
    const hist = JSON.parse(localStorage.getItem("historial_borrados")) || [];
    hist.unshift({
        id: Date.now(),
        tipo, // "contador" | "fila" | "tabla"
        detalle,
        usuario: sesion.user || "desconocido",
        rol: sesion.rol || "sin_rol",
        fecha: new Date().toLocaleString(),
        datos
    });
    localStorage.setItem("historial_borrados", JSON.stringify(hist));
}

// 1) Reiniciar contador global a 0 (solo administrador)
function reiniciarContadorGlobalSi() {
    if (!esAdminActual()) {
        alert("⚠ Solo el administrador puede reiniciar el contador global a 0.");
        return;
    }
    const anterior = parseInt(localStorage.getItem("contadorGlobalSi") || "0", 10);
    registrarHistorialBorrado("contador", "Reinicio de contadorGlobalSi a 0", { anterior });
    localStorage.setItem("contadorGlobalSi", 0);
    const spanSi = document.getElementById("contadorSi");
    if (spanSi) spanSi.innerText = 0;
    alert("✔ Contador global reiniciado a 0.");
}

// 2) Borrar una fila de un arreglo en localStorage (ej. "contratos_indexados" o "control_tiempos")
function borrarFilaStorage(claveStorage, indice, etiqueta = "registro") {
    if (!esAdminActual()) {
        alert("⚠ Solo el administrador puede borrar filas.");
        return false;
    }
    const lista = JSON.parse(localStorage.getItem(claveStorage)) || [];
    if (indice < 0 || indice >= lista.length) return false;
    const [eliminada] = lista.splice(indice, 1);
    registrarHistorialBorrado("fila", `Eliminada fila de ${etiqueta}`, eliminada);
    localStorage.setItem(claveStorage, JSON.stringify(lista));
    return true;
}

// 3) Borrar toda una tabla/lista en localStorage
function borrarTablaStorage(claveStorage, etiqueta = "tabla") {
    if (!esAdminActual()) {
        alert("⚠ Solo el administrador puede borrar tablas completas.");
        return false;
    }
    const lista = JSON.parse(localStorage.getItem(claveStorage)) || [];
    if (lista.length === 0) {
        alert("No hay registros para borrar.");
        return false;
    }
    if (!confirm(`¿Seguro que deseas borrar TODOS los registros de ${etiqueta}? Quedarán en el historial de borrados.`)) {
        return false;
    }
    registrarHistorialBorrado("tabla", `Borrado completo de ${etiqueta} (${lista.length} registros)`, lista);
    localStorage.setItem(claveStorage, JSON.stringify([]));
    return true;
}

// 4) Restaurar un borrado accidental desde el historial
function restaurarBorradoAccidental(idRegistro) {
    if (!esAdminActual()) {
        alert("⚠ Solo el administrador puede restaurar registros.");
        return false;
    }
    const hist = JSON.parse(localStorage.getItem("historial_borrados")) || [];
    const idx = hist.findIndex(h => h.id === idRegistro);
    if (idx === -1) return false;

    const item = hist[idx];
    if (item.tipo === "contador" && item.datos && typeof item.datos.anterior !== "undefined") {
        localStorage.setItem("contadorGlobalSi", item.datos.anterior);
        const spanSi = document.getElementById("contadorSi");
        if (spanSi) spanSi.innerText = item.datos.anterior;
    } else if (item.tipo === "fila" && item.datos) {
        const actuales = JSON.parse(localStorage.getItem("contratos_indexados")) || [];
        actuales.push(item.datos);
        localStorage.setItem("contratos_indexados", JSON.stringify(actuales));
    } else if (item.tipo === "tabla" && Array.isArray(item.datos)) {
        localStorage.setItem("contratos_indexados", JSON.stringify(item.datos));
    }

    hist.splice(idx, 1);
    localStorage.setItem("historial_borrados", JSON.stringify(hist));
    return true;
}