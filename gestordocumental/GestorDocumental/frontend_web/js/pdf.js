

class GestorPdfContrato {


    static guardarPdfAlIndexar(nroContrato, nombreCliente, listaDeArchivos) {
        if (listaDeArchivos && listaDeArchivos.length > 0) {
            const docActual = listaDeArchivos[0];
            if (docActual && docActual.url) {
                const folioLimpio = nroContrato ? nroContrato.trim() : "S_N";
                const claveUnica = "pdf_contrato_" + folioLimpio;


                localStorage.setItem(claveUnica, docActual.url);
                sessionStorage.setItem("pdf_para_reporte", docActual.url);
                sessionStorage.setItem("nombre_archivo_reporte", `${folioLimpio} ${nombreCliente}.pdf`);

                console.log("✔ PDF del contrato guardado correctamente para el folio:", folioLimpio);
            }
        }
    }


    static abrirVisorReporte(registros) {
        if (!registros || registros.length === 0) {
            alert("⚠ No hay registros indexados para generar el documento.");
            return;
        }

        let primerReg = registros[0];
        let folio = primerReg.nroContrato || 'S/N';
        let cliente = primerReg.nombreCliente || 'Cliente';
        let nombreArchivoFinal = folio + " " + cliente;


        let pdfUrl = localStorage.getItem("pdf_contrato_" + folio.trim()) || sessionStorage.getItem("pdf_para_reporte") || primerReg.pdfUrl;

        let ventanaImpresion = window.open('', '_blank');
        let html = '<html lang="es"><head><meta charset="utf-8">';
        html += '<title>' + nombreArchivoFinal + '</title>';
        html += '<style>';
        html += 'body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #525659; }';
        html += '#visor-pdf { width: 100%; height: 100%; border: none; }';
        html += '.barra-superior { position: absolute; top: 0; left: 0; right: 0; background: #1e293b; color: white; padding: 10px; font-family: Arial; font-size: 14px; display: flex; justify-content: space-between; align-items: center; z-index: 10; }';
        html += '.btn-guardar { background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; }';
        html += '</style></head><body>';

        if (pdfUrl) {
            html += '<div class="barra-superior">';
            html += '<span><b>Documento:</b> ' + nombreArchivoFinal + '</span>';
            html += '<button class="btn-guardar" onclick="window.print()">Imprimir / Guardar PDF</button>';
            html += '</div>';
            html += '<embed id="visor-pdf" src="' + pdfUrl + '#toolbar=1" type="application/pdf" />';
        } else {
            html += '<div style="color: white; text-align: center; margin-top: 100px; font-family: Arial;">';
            html += '<h2>⚠ No se encontró el archivo PDF para este contrato</h2>';
            html += '<p>Por favor verifica que el documento haya sido importado e indexado correctamente.</p>';
            html += '</div>';
        }

        html += '</body></html>';
        ventanaImpresion.document.write(html);
        ventanaImpresion.document.close();
    }
}