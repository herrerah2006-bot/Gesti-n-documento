(function () {
    function obtenerSesion() {
        try {
            return JSON.parse(localStorage.getItem("sesion_usuario")) || null;
        } catch {
            return null;
        }
    }

    function obtenerRolActual() {
        const sesion = obtenerSesion();
        const rol = sesion && sesion.rol ? String(sesion.rol).toLowerCase() : null;
        return ["administrador", "usuario", "lector"].includes(rol) ? rol : null;
    }

    // Helper global para usar en las demás vistas y tablas
    window.GestorPermisos = {
        obtenerSesion,
        obtenerRol: obtenerRolActual,
        esAdmin: () => obtenerRolActual() === "administrador",
        esUsuario: () => obtenerRolActual() === "usuario",
        esLector: () => obtenerRolActual() === "lector",
        puedeEditar: () => obtenerRolActual() === "administrador",
        puedeBorrar: () => obtenerRolActual() === "administrador",
        puedeOperar: () => ["administrador", "usuario"].includes(obtenerRolActual()),
        registrarBorrado: (tipo, detalle, datos) => {
            const sesion = obtenerSesion() || {};
            const historial = JSON.parse(localStorage.getItem("historial_borrados")) || [];
            historial.unshift({
                id: Date.now(),
                tipo, // "fila" | "tabla" | "contador"
                detalle,
                usuario: sesion.user || "desconocido",
                rol: sesion.rol || "sin_rol",
                fecha: new Date().toLocaleString(),
                datos
            });
            localStorage.setItem("historial_borrados", JSON.stringify(historial));
        }
    };

    function cargarMenu() {
        const navContainer = document.getElementById("nav-container");
        if (!navContainer) return;

        const path = window.location.pathname;
        const sesion = obtenerSesion();
        const rol = obtenerRolActual() || "sin rol";

        const isBusqueda = path.includes("busqueda.html");
        const isIndex = path.includes("index.html") || path.endsWith("/") || path.endsWith("gestordocumental/");
        const isReporte = path.includes("reporte.html");
        const isControlTiempos = path.includes("control-tiempos.html");

        const badgeColor =
            rol === "administrador"
                ? "bg-amber-100 text-amber-800 border-amber-300"
                : rol === "usuario"
                ? "bg-blue-100 text-blue-800 border-blue-300"
                : "bg-slate-200 text-slate-700 border-slate-300";

        navContainer.innerHTML = `
            <div class="w-36 bg-slate-100 border-r border-gray-300 p-2 space-y-1.5 flex flex-col text-[11px] min-h-screen">
                <span class="font-bold text-gray-500 px-1 mb-1 text-[10px] uppercase">Menú</span>

                <div class="px-1.5 py-1 rounded bg-white border border-gray-200 mb-1">
                    <div class="font-semibold text-slate-800 truncate">${sesion && sesion.user ? sesion.user : "Invitado"}</div>
                    <span class="inline-block mt-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded border ${badgeColor}">${rol}</span>
                </div>
                
                <a href="busqueda.html" id="menuBusqueda" class="block px-2 py-1.5 rounded transition-colors ${isBusqueda ? 'text-blue-700 font-bold bg-blue-50' : 'text-gray-700 hover:bg-slate-200'}">Búsqueda</a>
                
                <a href="index.html" id="menuIndexamiento" class="block px-2 py-1.5 rounded transition-colors ${isIndex ? 'text-blue-700 font-bold bg-blue-50' : 'text-gray-700 hover:bg-slate-200'}">Indexamiento</a>
                
                <a href="reporte.html" id="menuReportes" class="block px-2 py-1.5 rounded transition-colors ${isReporte ? 'text-blue-700 font-bold bg-blue-50' : 'text-gray-700 hover:bg-slate-200'}">Reportes</a>
                
                <a href="control-tiempos.html" id="menuControlTiempos" class="block px-2 py-1.5 rounded transition-colors ${isControlTiempos ? 'text-blue-700 font-bold bg-blue-50' : 'text-gray-700 hover:bg-slate-200'}">Control Tiempos</a>
                
                <span id="menuSalir" class="block text-red-600 hover:bg-red-50 px-2 py-1.5 rounded cursor-pointer mt-auto">Salir</span>
            </div>
        `;

        const btnSalir = document.getElementById("menuSalir");
        if (btnSalir) {
            btnSalir.addEventListener("click", () => {
                if (confirm("¿Estás seguro de que deseas salir del sistema?")) {
                    localStorage.removeItem("sesion_activa");
                    localStorage.removeItem("sesion_usuario");
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