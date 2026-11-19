document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.getElementById("tablaBusquedaBody");
    const inputFolio = document.getElementById("buscarFolio");
    const inputCliente = document.getElementById("buscarCliente");
    const inputDistribuidor = document.getElementById("buscarDistribuidor");
    const btnLimpiar = document.getElementById("btnLimpiarBusqueda");

    if (!tbody) return;


    function obtenerTodosLosRegistros() {
        return JSON.parse(localStorage.getItem("contratos_indexados")) || [];
    }


    function renderizarBusqueda(lista) {
        tbody.innerHTML = "";

        if (lista.length === 0) {
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

            const folioStr = item.nroContrato || item.folio || '';
            const clienteStr = item.nombreCliente || item.cliente || '';
            const distribuidorStr = item.nroDistribuidor || item.distribuidor || '';
            const empresaStr = item.nombreEmpresa || '';
            const observacionesStr = item.observaciones || item.obsHojas || '';

            fila.innerHTML = `
                <td class="p-2 border-r">${item.fechaProceso || ''}</td>
                <td class="p-2 border-r">${item.fechaContrato || ''}</td>
                <td class="p-2 border-r">${distribuidorStr}</td>
                <td class="p-2 border-r font-semibold text-indigo-700">${folioStr}</td>
                <td class="p-2 border-r">${clienteStr}</td>
                <td class="p-2 border-r">${empresaStr}</td>
                <td class="p-2">${observacionesStr}</td>
            `;
            tbody.appendChild(fila);
        });
    }


    function filtrarRegistros() {
        const todos = obtenerTodosLosRegistros();
        const textoFolio = (inputFolio?.value || "").toLowerCase().trim();
        const textoCliente = (inputCliente?.value || "").toLowerCase().trim();
        const textoDist = (inputDistribuidor?.value || "").toLowerCase().trim();

        const filtrados = todos.filter(item => {
            const f = (item.nroContrato || item.folio || "").toLowerCase();
            const c = (item.nombreCliente || item.cliente || "").toLowerCase();
            const d = (item.nroDistribuidor || item.distribuidor || "").toLowerCase();

            return f.includes(textoFolio) && c.includes(textoCliente) && d.includes(textoDist);
        });

        renderizarBusqueda(filtrados);
    }


    if (inputFolio) inputFolio.addEventListener("input", filtrarRegistros);
    if (inputCliente) inputCliente.addEventListener("input", filtrarRegistros);
    if (inputDistribuidor) inputDistribuidor.addEventListener("input", filtrarRegistros);


    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", () => {
            if (inputFolio) inputFolio.value = "";
            if (inputCliente) inputCliente.value = "";
            if (inputDistribuidor) inputDistribuidor.value = "";
            renderizarBusqueda(obtenerTodosLosRegistros());
        });
    }

    renderizarBusqueda(obtenerTodosLosRegistros());
});