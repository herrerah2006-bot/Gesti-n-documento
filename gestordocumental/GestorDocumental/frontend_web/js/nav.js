

(function () {
    function cargarMenu() {
        const navContainer = document.getElementById("nav-container");
        if (!navContainer) return;

        const path = window.location.pathname;

        
        const isIndex = path.includes("index.html") || path.endsWith("/") || path.endsWith("gestordocumental/");
        const isReporte = path.includes("reporte.html");
        const isControlTiempos = path.includes("control-tiempos.html");

        navContainer.innerHTML = `
            <div class="w-36 bg-slate-100 border-r border-gray-300 p-2 space-y-1.5 flex flex-col text-[11px]">
                <span class="font-bold text-gray-500 px-1 mb-1 text-[10px] uppercase">Menú</span>
                <span id="menuBusqueda" class="block text-gray-800 hover:bg-slate-200 px-2 py-1.5 rounded cursor-pointer font-medium">Búsqueda</span>
                
                <a href="index.html" id="menuIndexamiento" class="block ${isIndex ? 'text-blue-700 bg-blue-50 font-bold' : 'text-gray-800 hover:bg-slate-200 font-medium'} px-2 py-1.5 rounded cursor-pointer no-underline">Indexamiento</a>
                
                <a href="reporte.html" id="menuReportes" class="block ${isReporte ? 'text-blue-700 bg-blue-50 font-bold' : 'text-gray-800 hover:bg-slate-200 font-medium'} px-2 py-1.5 rounded cursor-pointer no-underline">Reportes</a>
                
                <a href="control-tiempos.html" id="menuControlTiempos" class="block ${isControlTiempos ? 'text-blue-700 bg-blue-50 font-bold' : 'text-gray-800 hover:bg-slate-200 font-medium'} px-2 py-1.5 rounded cursor-pointer no-underline">Control Tiempos</a>
                
                <span id="menuSalir" class="block text-red-600 hover:bg-red-50 px-2 py-1.5 rounded cursor-pointer font-medium">Salir</span>
            </div>
        `;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", cargarMenu);
    } else {
        cargarMenu();
    }
})();