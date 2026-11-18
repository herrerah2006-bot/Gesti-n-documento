let paginaActual = 1;
const totalPaginas = 6;
let listaDeArchivos = [];

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

    
    const archivosGuardados = localStorage.getItem("lista_de_archivos_sesion");
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
        const valorGuardado = localStorage.getItem("borrador_" + input.id);
        if (valorGuardado) {
            input.value = valorGuardado;
        }
        input.addEventListener("input", () => {
            localStorage.setItem("borrador_" + input.id, input.value);
        });
    });

    actualizarListaDocumentos();

   // 3. BOTONES DE INDEXACIÓN (SUPERIOR Y PANEL)
    const btnIndexadoSup = document.getElementById("btnIndexadoSuperior");
    const btnIndexadoPan = document.getElementById("btnIndexadoPanel");

    [btnIndexadoSup, btnIndexadoPan].forEach(el => {
        if (el) {
            el.addEventListener("click", () => {
                // Validación estricta con la lista real sincronizada
                if (listaDeArchivos.length === 0) {
                    alert("⚠ Error: No hay documentos pendientes. Debe importar un documento primero.");
                    return;
                }

                const fechaProceso = document.getElementById('fechaProceso')?.value.trim() || "";
                const fechaContrato = document.getElementById('fechaContrato')?.value.trim() || "";
                const nroDistribuidor = document.getElementById('nroDistribuidor')?.value.trim() || "";
                const nroContrato = document.getElementById('nroContrato')?.value.trim() || "";
                const nombreCliente = document.getElementById('nombreCliente')?.value.trim() || "";
                const observaciones = document.getElementById('observaciones')?.value.trim() || document.getElementById('obsHojas')?.value.trim() || "";
                const nombreEmpresa = document.getElementById('nombreEmpresa')?.value.trim() || "";
                const codigoEmpresa = document.getElementById('codigoEmpresa')?.value.trim() || "";
                const areaEmpresa = document.getElementById('areaEmpresa')?.value.trim() || "";

                if (!fechaProceso || !fechaContrato || !nroDistribuidor || !nroContrato || !nombreCliente || !nombreEmpresa || !codigoEmpresa || !areaEmpresa) {
                    alert("⚠ Error: Todos los apartados y campos de la metadata deben estar llenos antes de indexar el contrato.");
                    return;
                }

                // 1. DESCARGAR AUTOMÁTICAMENTE EL PDF A LA PC
                if (listaDeArchivos.length > 0) {
                    try {
                        const docActual = listaDeArchivos[0];
                        const linkDescarga = document.createElement('a');
                        linkDescarga.href = docActual.url;
                        linkDescarga.download = `Contrato_${nroContrato}_${nombreCliente}.pdf`;
                        document.body.appendChild(linkDescarga);
                        linkDescarga.click();
                        document.body.removeChild(linkDescarga);
                    } catch (err) {
                        console.error("Error al descargar el PDF:", err);
                    }
                }

                // 2. Enviar la metadata al servidor Java y MySQL
                guardarMetadataEnServidor();

                // 3. Incrementar contadores y control de tiempos
                incrementarContadorSi();

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
                    fechaRegistro: new Date().toLocaleString()
                };

                let registrosGuardados = JSON.parse(localStorage.getItem("contratos_indexados")) || [];
                registrosGuardados.push(datosContrato);
                localStorage.setItem("contratos_indexados", JSON.stringify(registrosGuardados));

                // Actualizar control de tiempos para hoy
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

                // 4. Mover la lista de archivos, actualizar DOM y vaciar casillas/borradores
                listaDeArchivos.shift();
                localStorage.setItem("lista_de_archivos_sesion", JSON.stringify(listaDeArchivos));
                actualizarListaDocumentos();
                limpiarBorradorFormulario();

                // Limpiar explícitamente los inputs visuales del formulario
                const inputsForm = document.querySelectorAll("#formIndexacion input, #formIndexacion textarea");
                inputsForm.forEach(input => { input.value = ""; });

                alert("✔ ¡Contrato indexado, PDF descargado a la PC y enviado a MySQL con éxito!");
            });
        }
    });

    
    const btnImportar = document.getElementById("btnImportar");
    const inputArchivoPdf = document.getElementById("inputArchivoPdf");

    if (btnImportar && inputArchivoPdf) {
        btnImportar.addEventListener("click", () => {
            inputArchivoPdf.click();
        });

        inputArchivoPdf.addEventListener("change", (e) => {
            const archivo = e.target.files[0];
            if (archivo) {
                const lector = new FileReader();
                lector.onload = function(evento) {
                    const base64Data = evento.target.result;
                    const nuevoDoc = { nombre: archivo.name, url: base64Data };
                    listaDeArchivos.push(nuevoDoc);
                    localStorage.setItem("lista_de_archivos_sesion", JSON.stringify(listaDeArchivos));
                    
                    actualizarListaDocumentos();
                    mostrarEnVisor(nuevoDoc);
                };
                lector.readAsDataURL(archivo);
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

    
    if (listaDeArchivos.length > 0) {
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
                    <p class="text-xs text-gray-500">Documento cargado en el visor.</p>
                </div>
            `;
        }
    }
}


function actualizarVisorPagina() {
    const indicador = document.getElementById("indicadorPagina");
    if (indicador) {
        indicador.innerText = `${paginaActual} / ${totalPaginas}`;
    }
}


function guardarMetadataEnServidor() {
    const data = {
        fechaProceso: document.getElementById('fechaProceso')?.value || '',
        fechaContrato: document.getElementById('fechaContrato')?.value || '',
        nroDistribuidor: document.getElementById('nroDistribuidor')?.value || '',
        nroContrato: document.getElementById('nroContrato')?.value || '',
        nombreCliente: document.getElementById('nombreCliente')?.value || '',
        observaciones: document.getElementById('observaciones')?.value || '',
        nombreEmpresa: document.getElementById('nombreEmpresa')?.value || '',
        codigoEmpresa: document.getElementById('codigoEmpresa')?.value || '',
        areaEmpresa: document.getElementById('areaEmpresa')?.value || ''
    };

    fetch('http://localhost:8080/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(response => {
        // Opcional: puedes dejar la notificación aquí o dejar solo la del botón principal
    })
    .catch(err => {
        console.error("Error de conexión:", err);
        alert("Error: No se pudo conectar con el servidor Java en el puerto 8080.");
    });
}


function limpiarBorradorFormulario() {
    const inputsForm = document.querySelectorAll("#formIndexacion input, #formIndexacion textarea, input[id*='fecha'], input[id*='nro'], input[id*='nombre'], input[id*='observaciones'], input[id*='codigo'], input[id*='area']");
    inputsForm.forEach(input => {
        if (!input.id) return;
        localStorage.removeItem("borrador_" + input.id);
        input.value = "";
    });
}