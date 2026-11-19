
class AIExtractorButton {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
        this.init();
    }

    init() {
        if (!this.container) return;


        const btn = document.createElement('button');
        btn.id = 'btnAiExtract';
        btn.innerHTML = '✨ Autocompletar con IA';
        btn.style.cssText = 'background-color: #4A90E2; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-left: 10px;';

        btn.onclick = () => this.analizarDocumento(btn);


        this.container.appendChild(btn);
    }

    async analizarDocumento(btn) {
        btn.innerText = '⏳ Leyendo...';
        btn.disabled = true;

        try {

            const response = await fetch('/api/gemini/analizar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timestamp: Date.now() })
            });

            const data = await response.json();

            if (data && !data.error) {

                document.querySelector('input[name="fecha_procesamiento"]').value = data.fecha_procesamiento || '';
                document.querySelector('input[name="fecha_contrato"]').value = data.fecha_contrato || '';
                document.querySelector('input[name="numero_distribuidor"]').value = data.numero_distribuidor || '';
                document.querySelector('input[name="numero_contrato"]').value = data.numero_contrato || '';
                document.querySelector('input[name="nombre_cliente"]').value = data.nombre_cliente || '';
                document.querySelector('input[name="nombre_empresa"]').value = data.nombre_empresa || '';
                document.querySelector('input[name="codigo_empresa"]').value = data.codigo_empresa || '';
                document.querySelector('input[name="area_empresa"]').value = data.area_empresa || '';
            } else {
                alert("No se pudo extraer la información del documento.");
            }
        } catch (error) {
            console.error("Error en la petición de IA:", error);
        } finally {
            btn.innerText = '✨ Autocompletar con IA';
            btn.disabled = false;
        }
    }
}