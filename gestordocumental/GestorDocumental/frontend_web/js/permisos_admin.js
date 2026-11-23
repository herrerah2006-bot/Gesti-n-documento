function obtenerSesionActiva() {
    try {
        return JSON.parse(localStorage.getItem("sesion_usuario")) || null;
    } catch {
        return null;
    }
}

function esAdministrador() {
    const sesion = obtenerSesionActiva();
    return sesion && sesion.rol === "administrador";
}

// Registrar en el historial antes de borrar una fila o tabla completa
function registrarEnHistorialBorrado(tipo, descripcion, datosEliminados) {
    const sesion = obtenerSesionActiva();
    const historial = JSON.parse(localStorage.getItem("historial_borrados")) || [];

    historial.unshift({
        id: Date.now(),
        tipo, // "fila" | "tabla" | "contador"
        descripcion,
        usuario: sesion ? sesion.user : "desconocido",
        fechaHora: new Date().toLocaleString(),
        datos: datosEliminados
    });

    localStorage.setItem("historial_borrados", JSON.stringify(historial));
}

// Restaurar un elemento del historial por accidente
function restaurarDesdeHistorial(idHistorial, destinoLocalStorageKey, esArray = true) {
    if (!esAdministrador()) {
        alert("⚠ Solo el administrador puede restaurar registros.");
        return false;
    }

    const historial = JSON.parse(localStorage.getItem("historial_borrados")) || [];
    const item = historial.find(h => h.id === idHistorial);
    if (!item) return false;

    if (esArray) {
        const actual = JSON.parse(localStorage.getItem(destinoLocalStorageKey)) || [];
        const datosARestaurar = Array.isArray(item.datos) ? item.datos : [item.datos];
        localStorage.setItem(destinoLocalStorageKey, JSON.stringify([...datosARestaurar, ...actual]));
    } else {
        localStorage.setItem(destinoLocalStorageKey, JSON.stringify(item.datos));
    }

    const nuevoHistorial = historial.filter(h => h.id !== idHistorial);
    localStorage.setItem("historial_borrados", JSON.stringify(nuevoHistorial));
    return true;
}

// Reiniciar contador global a 0 (solo administrador)
function reiniciarContadorGlobal(claveContador = "contador_global") {
    if (!esAdministrador()) {
        alert("⚠ Acción restringida: solo el administrador puede reiniciar el contador global.");
        return false;
    }

    const valorAnterior = localStorage.getItem(claveContador);
    registrarEnHistorialBorrado("contador", "Reinicio de contador global a 0", { valorAnterior });
    localStorage.setItem(claveContador, JSON.stringify(0));
    return true;
}