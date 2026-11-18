(function () {
    function cargarMenu() {
        const navContainer = document.getElementById("nav-container");
        if (!navContainer) return;

        const path = window.location.pathname;

        // Detectar en qué página estamos para resaltar la opción activa
        const isBusqueda = path.includes("busqueda.html");
        const isIndex = path.includes("index.html") || path.endsWith("/") || path.endsWith("gestordocumental/");
        const isReporte = path.includes("reporte.html");
        const isControlTiempos = path.includes("control-tiempos.html");

        navContainer.innerHTML = `
            <div class="w-36 bg-slate-100 border-r border-gray-300 p-2 space-y-1.5 flex flex-col text-[11px]">
                <span class="font-bold text-gray-500 px-1 mb-1 text-[10px] uppercase">Menú</span>
                
                <a href="busqueda.html" id="menuBusqueda" class="block px-2 py-1.5 rounded transition-colors ${isBusqueda ? 'text-blue-700 font-bold bg-blue-50' : 'text-gray-700 hover:bg-slate-200'}">Búsqueda</a>
                
                <a href="index.html" id="menuIndexamiento" class="block px-2 py-1.5 rounded transition-colors ${isIndex ? 'text-blue-700 font-bold bg-blue-50' : 'text-gray-700 hover:bg-slate-200'}">Indexamiento</a>
                
                <a href="reporte.html" id="menuReportes" class="block px-2 py-1.5 rounded transition-colors ${isReporte ? 'text-blue-700 font-bold bg-blue-50' : 'text-gray-700 hover:bg-slate-200'}">Reportes</a>
                
                <a href="control-tiempos.html" id="menuControlTiempos" class="block px-2 py-1.5 rounded transition-colors ${isControlTiempos ? 'text-blue-700 font-bold bg-blue-50' : 'text-gray-700 hover:bg-slate-200'}">Control Tiempos</a>
                
                <span id="menuSalir" class="block text-red-600 hover:bg-red-50 px-2 py-1.5 rounded cursor-pointer mt-auto">Salir</span>
            </div>
        `;

        // Configurar el evento del botón salir
        const btnSalir = document.getElementById("menuSalir");
        if (btnSalir) {
            btnSalir.addEventListener("click", () => {
                if (confirm("¿Estás seguro de que deseas salir del sistema?")) {
                    localStorage.removeItem("sesion_activa");
                    window.location.href = "login.html";
                }
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", cargarMenu);
    } else {
        cargarMenu();
    }
})();