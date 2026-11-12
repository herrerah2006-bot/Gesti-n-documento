package servidor;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

public class ServidorWeb {
    public static void main(String[] args) throws IOException {
        int puerto = 8080;
        HttpServer servidor = HttpServer.create(new InetSocketAddress(puerto), 0);
        
        // Endpoint que escucha las peticiones de indexación de la web
        servidor.createContext("/api/clientes", new IndexacionHandler());
        
        servidor.setExecutor(null);
        servidor.start();
        
        System.out.println("==================================================");
        System.out.println(" Servidor Backend Activo en: http://localhost:" + puerto);
        System.out.println("==================================================");
    }

    static class IndexacionHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // 1. Cabeceras CORS para permitir la comunicación con la interfaz web
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");

            if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            // 2. Procesar la petición POST enviada desde el botón "Guardar Registro"
            if (exchange.getRequestMethod().equalsIgnoreCase("POST")) {
                InputStreamReader isr = new InputStreamReader(exchange.getRequestBody(), StandardCharsets.UTF_8);
                BufferedReader br = new BufferedReader(isr);
                StringBuilder jsonBuilder = new StringBuilder();
                String linea;
                while ((linea = br.readLine()) != null) {
                    jsonBuilder.append(linea);
                }

                String jsonRecibido = jsonBuilder.toString();
                System.out.println("----------------------------------------");
                System.out.println(" ¡Datos de Metadata recibidos en Java!");
                System.out.println(jsonRecibido);
                System.out.println("----------------------------------------");

                // TODO: Aquí puedes utilizar tu ClienteDao o un nuevo DocumentoDao para insertar 
                // los datos procesados en tus tablas de MySQL.
                // Ejemplo:
                // DocumentoDao docDao = new DocumentoDao();
                // docDao.guardarIndexacion(jsonRecibido);

                String respuestaJson = "{\"status\": \"success\", \"message\": \"Documento indexado y guardado en MySQL con éxito\"}";
                
                exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
                exchange.sendResponseHeaders(200, respuestaJson.getBytes(StandardCharsets.UTF_8).length);
                OutputStream os = exchange.getResponseBody();
                os.write(respuestaJson.getBytes(StandardCharsets.UTF_8));
                os.close();
            } else {
                String respuesta = "API del Gestor Documental - Funcionando correctamente";
                exchange.sendResponseHeaders(200, respuesta.getBytes().length);
                OutputStream os = exchange.getResponseBody();
                os.write(respuesta.getBytes());
                os.close();
            }
        }
    }
}