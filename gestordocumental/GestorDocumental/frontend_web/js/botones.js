// ========================================================== */
// Lógica Interactiva para Elementos de Texto / Acciones      //
// ========================================================== */

let paginaActual = 1;
const totalPaginas = 6;
let listaDeArchivos = [];

document.addEventListener("DOMContentLoaded", () => {

    // 0. Inicializar o forzar el contador global "SI" limpiamente en 0 si no existe
    let contadorSiActual = localStorage.getItem('contadorGlobalSi');
    if (contadorSiActual === null || isNaN(contadorSiActual) || parseInt(contadorSiActual) > 10000) {
        contadorSiActual = 0;
        localStorage.setItem('contadorGlobalSi', 0);
    }

    const spanSi = document.getElementById("contadorSi");
    if (spanSi) {
        spanSi.innerText = contadorSiActual;
    }

    // 1. Renderizar la lista inicial de documentos (calcula automáticamente el contador "NO")
    actualizarListaDocumentos();

   // 2. Evento para "Contrato Indexado (ok)" (Superior y Panel) con validación estricta
    const btnIndexadoSup = document.getElementById("btnIndexadoSuperior");
    const btnIndexadoPan = document.getElementById("btnIndexadoPanel");

    [btnIndexadoSup, btnIndexadoPan].forEach(el => {
        if (el) {
            el.addEventListener("click", () => {
                
                // REGLA 1: Verificar que realmente existan documentos en la lista (NO > 0)
                if (listaDeArchivos.length === 0) {
                    alert("⚠ Error: No hay documentos pendientes. El contador NO está en 0, debe importar un documento primero.");
                    return;
                }

                // REGLA 2: Verificar que todos los apartados de metadata estén llenos
                const fechaProceso = document.getElementById('fechaProceso').value.trim();
                const fechaContrato = document.getElementById('fechaContrato').value.trim();
                const nroDistribuidor = document.getElementById('nroDistribuidor').value.trim();
                const nroContrato = document.getElementById('nroContrato').value.trim();
                const nombreCliente = document.getElementById('nombreCliente').value.trim();
                const observaciones = document.getElementById('observaciones').value.trim();
                const nombreEmpresa = document.getElementById('nombreEmpresa').value.trim();
                const codigoEmpresa = document.getElementById('codigoEmpresa').value.trim();
                const areaEmpresa = document.getElementById('areaEmpresa').value.trim();

                if (!fechaProceso || !fechaContrato || !nroDistribuidor || !nroContrato || !nombreCliente || !observaciones || !nombreEmpresa || !codigoEmpresa || !areaEmpresa) {
                    alert("⚠ Error: Todos los apartados y campos de la metadata deben estar llenos antes de indexar el contrato.");
                    return;
                }

                // REGLA 3: Si todo es correcto, el SI suma 1 y el NO baja 1 (removiendo el documento procesado)
                incrementarContadorSi();

                // Tomamos el documento de la lista de pendientes y lo sacamos (el contador NO baja automáticamente)
                listaDeArchivos.shift();
                actualizarListaDocumentos();

                // Limpiar visor si ya no quedan documentos
                if (listaDeArchivos.length === 0) {
                    const tituloVisor = document.getElementById("nombreDocumentoVisor");
                    const lienzoVisor = document.getElementById("contenedorLienzoVisor");
                    if (tituloVisor) tituloVisor.innerText = "Seleccione un documento";
                    if (lienzoVisor) {
                        lienzoVisor.innerHTML = `
                            <div class="bg-white shadow-2xl border border-gray-400 p-8 max-w-xl w-full text-center rounded">
                                <div class="border-2 border-dashed border-indigo-300 p-16 rounded bg-indigo-50/50">
                                    <p class="text-indigo-900 font-bold mb-1">📄 Sin documento seleccionado</p>
                                    <p class="text-xs text-gray-500">Todos los documentos pendientes han sido procesados.</p>
                                </div>
                            </div>
                        `;
                    }
                }

                alert("✔ ¡Contrato indexado con éxito! Se restó 1 al contador NO y se sumó 1 al contador SI.");
            });
        }
    });

    // 3. Importar documentos escaneados (Abre el explorador de archivos de la PC)
    const btnImportar = document.getElementById("btnImportar");
    const inputArchivoPdf = document.getElementById("inputArchivoPdf");

    if (btnImportar && inputArchivoPdf) {
        btnImportar.addEventListener("click", () => {
            inputArchivoPdf.click();
        });

        inputArchivoPdf.addEventListener("change", (e) => {
            const archivo = e.target.files[0];
            if (archivo) {
                const urlLocal = URL.createObjectURL(archivo);
                const nuevoDoc = { nombre: archivo.name, url: urlLocal };
                listaDeArchivos.push(nuevoDoc);
                actualizarListaDocumentos();
                mostrarEnVisor(nuevoDoc);
            }
        });
    }

    // 4. Guardar registro en MySQL (Solo guarda y procesa la lista, YA NO TOCA EL CONTADOR "SI")
    const btnGuardar = document.getElementById("btnGuardar");
    if (btnGuardar) {
        btnGuardar.addEventListener("click", guardarMetadataEnServidor);
    }

    // 5. Navegación del visor (⟨ / ⟩)
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
});

// Función estricta para incrementar el contador "SI" exactamente de 1 en 1
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

// Función para renderizar la lista lateral de documentos y actualizar el contador NO automáticamente
function actualizarListaDocumentos() {
    const contenedor = document.getElementById("listaDocumentos");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    // Actualiza dinámicamente el contador "NO" según la cantidad de documentos en la lista
    const contadorNoEl = document.getElementById("contadorNo");
    if (contadorNoEl) {
        contadorNoEl.innerText = listaDeArchivos.length;
    }

    listaDeArchivos.forEach((doc, index) => {
        const linkDoc = document.createElement("a");
        linkDoc.href = "#";
        linkDoc.className = `block p-0.5 rounded truncate transition hover:bg-slate-700 cursor-pointer ${
            index === 0 ? 'bg-slate-800 font-bold text-white' : 'opacity-80 text-blue-300'
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

// Cargar documento en el visor principal
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
                    <p class="font-bold text-slate-800 mb-2">📄 ${doc.nombre}</p>
                    <p class="text-xs text-gray-500">Documento cargado en el visor.</p>
                </div>
            `;
        }
    }
}

// Actualizar contador del visor de páginas
function actualizarVisorPagina() {
    const indicador = document.getElementById("indicadorPagina");
    if (indicador) {
        indicador.innerText = `${paginaActual} / ${totalPaginas}`;
    }
}

// Conexión con el servidor Java para guardar en MySQL (sin tocar el contador "SI")
function guardarMetadataEnServidor() {
    const data = {
        fechaProceso: document.getElementById('fechaProceso').value,
        fechaContrato: document.getElementById('fechaContrato').value,
        nroDistribuidor: document.getElementById('nroDistribuidor').value,
        nroContrato: document.getElementById('nroContrato').value,
        nombreCliente: document.getElementById('nombreCliente').value,
        observaciones: document.getElementById('observaciones').value,
        nombreEmpresa: document.getElementById('nombreEmpresa').value,
        codigoEmpresa: document.getElementById('codigoEmpresa').value,
        areaEmpresa: document.getElementById('areaEmpresa').value
    };

    fetch('http://localhost:8080/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(response => {
        alert("¡Registro guardado en MySQL con éxito!");

        // Si se guardó con éxito, avanzamos en la lista de archivos pendientes
        if (listaDeArchivos.length > 0) {
            listaDeArchivos.shift();
            actualizarListaDocumentos();
        }
    })
    .catch(err => {
        console.error("Error de conexión:", err);
        alert("Error: No se pudo conectar con el servidor Java en el puerto 8080.");
    });
}