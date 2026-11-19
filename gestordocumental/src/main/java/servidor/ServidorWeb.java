package servidor;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import com.empresa.conexion.Conexion;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

public class ServidorWeb {
    public static void main(String[] args) throws IOException {
        int puerto = 8080;
        HttpServer servidor = HttpServer.create(new InetSocketAddress(puerto), 0);

        servidor.createContext("/api/clientes", new IndexacionHandler());
        servidor.createContext("/api/control-tiempos", new ControlTiemposHandler());

        servidor.setExecutor(null);
        servidor.start();

        System.out.println("==================================================");
        System.out.println(" Servidor Backend Activo en: http://localhost:" + puerto);
        System.out.println("==================================================");
    }

    static class IndexacionHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");

            if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

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

                String fechaProceso = extraerValorJson(jsonRecibido, "fechaProceso");
                String fechaContrato = extraerValorJson(jsonRecibido, "fechaContrato");
                String distribuidorId = extraerValorJson(jsonRecibido, "nroDistribuidor");
                String noFolio = extraerValorJson(jsonRecibido, "nroContrato");
                String clienteId = extraerValorJson(jsonRecibido, "nombreCliente");
                String observaciones = extraerValorJson(jsonRecibido, "observaciones");
                String nombreEmpresa = extraerValorJson(jsonRecibido, "nombreEmpresa");
                String codigoEmpresa = extraerValorJson(jsonRecibido, "codigoEmpresa");
                String areaEmpresa = extraerValorJson(jsonRecibido, "areaEmpresa");
                String archivo = extraerValorJson(jsonRecibido, "archivo");
                String driveUrl = extraerValorJson(jsonRecibido, "driveUrl");

                String respuestaJson = "{\"status\": \"success\", \"message\": \"Documento indexado y guardado en MySQL con éxito\"}";

                String sql = "INSERT INTO documentos (no_folio, fecha_proceso, fecha_contrato, distribuidor_id, cliente_id, observaciones, nombre_empresa, codigo_empresa, area_empresa, archivo, drive_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

                try (Connection conn = Conexion.obtenerConexion();
                        PreparedStatement pstmt = conn.prepareStatement(sql)) {

                    if (conn != null) {
                        pstmt.setString(1, noFolio);
                        pstmt.setString(2, fechaProceso);
                        pstmt.setString(3, fechaContrato);
                        pstmt.setString(4, distribuidorId);
                        pstmt.setString(5, clienteId);
                        pstmt.setString(6, observaciones);
                        pstmt.setString(7, nombreEmpresa);
                        pstmt.setString(8, codigoEmpresa);
                        pstmt.setString(9, areaEmpresa);
                        pstmt.setString(10, archivo);
                        pstmt.setString(11, driveUrl);

                        pstmt.executeUpdate();
                        System.out.println("✔ ¡Datos insertados en MySQL correctamente!");
                    } else {
                        System.out.println("⚠ No se pudo conectar a la base de datos.");
                    }
                } catch (SQLException e) {
                    System.err.println("⚠ Error SQL al insertar: " + e.getMessage());
                    e.printStackTrace();
                }

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

        private String extraerValorJson(String json, String clave) {
            try {
                String buscar = "\"" + clave + "\":\"";
                int inicio = json.indexOf(buscar);
                if (inicio == -1) {
                    buscar = "\"" + clave + "\":";
                    inicio = json.indexOf(buscar);
                    if (inicio == -1)
                        return "";
                    inicio += buscar.length();
                    int fin = json.indexOf(",", inicio);
                    if (fin == -1)
                        fin = json.indexOf("}", inicio);
                    if (fin == -1)
                        return "";
                    return json.substring(inicio, fin).trim().replace("\"", "");
                }
                inicio += buscar.length();
                int fin = json.indexOf("\"", inicio);
                if (fin == -1)
                    return "";
                return json.substring(inicio, fin);
            } catch (Exception e) {
                return "";
            }
        }
    }

    static class ControlTiemposHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");

            if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

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
                System.out.println(" ¡Datos de Control de Tiempos recibidos en Java!");
                System.out.println(jsonRecibido);
                System.out.println("----------------------------------------");

                String fechaTurno = extraerValorJson(jsonRecibido, "fechaTurno");
                String cantidad1 = extraerValorJson(jsonRecibido, "cantidad1");
                String horaInicio1 = extraerValorJson(jsonRecibido, "horaInicio1");
                String horaFin1 = extraerValorJson(jsonRecibido, "horaFin1");
                String cantidad2 = extraerValorJson(jsonRecibido, "cantidad2");
                String horaInicio2 = extraerValorJson(jsonRecibido, "horaInicio2");
                String horaFin2 = extraerValorJson(jsonRecibido, "horaFin2");
                String horasPorcentaje = extraerValorJson(jsonRecibido, "horasPorcentaje");
                String horasPorProceso = extraerValorJson(jsonRecibido, "horasPorProceso");
                String totalHoras = extraerValorJson(jsonRecibido, "totalHoras");
                String fechaCreacion = extraerValorJson(jsonRecibido, "fechaCreacion");

                String sql = "INSERT INTO control_tiempos (fecha_turno, cantidad_1, hora_inicio_1, hora_fin_1, cantidad_2, hora_inicio_2, hora_fin_2, horas_porcentaje, horas_por_proceso, total_horas, fecha_creacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

                String respuestaJson = "{\"status\": \"success\", \"message\": \"Control de tiempos guardado en MySQL con éxito\"}";

                try (Connection conn = Conexion.obtenerConexion();
                        PreparedStatement pstmt = conn.prepareStatement(sql)) {

                    if (conn != null) {
                        pstmt.setString(1, fechaTurno);
                        pstmt.setInt(2, parsearEnteroSeguro(cantidad1));
                        pstmt.setString(3, horaInicio1);
                        pstmt.setString(4, horaFin1);
                        pstmt.setInt(5, parsearEnteroSeguro(cantidad2));
                        pstmt.setString(6, horaInicio2);
                        pstmt.setString(7, horaFin2);
                        pstmt.setString(8, horasPorcentaje);
                        pstmt.setString(9, horasPorProceso);
                        pstmt.setString(10, totalHoras);
                        pstmt.setString(11, fechaCreacion);

                        pstmt.executeUpdate();
                        System.out.println("✔ ¡Control de tiempos insertado en MySQL correctamente!");
                    } else {
                        System.out.println("⚠ No se pudo conectar a la base de datos.");
                    }
                } catch (SQLException e) {
                    System.err.println("⚠ Error SQL al insertar control_tiempos: " + e.getMessage());
                    e.printStackTrace();
                }

                exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
                exchange.sendResponseHeaders(200, respuestaJson.getBytes(StandardCharsets.UTF_8).length);
                OutputStream os = exchange.getResponseBody();
                os.write(respuestaJson.getBytes(StandardCharsets.UTF_8));
                os.close();
            } else {
                String respuesta = "Endpoint Control de Tiempos - Activo";
                exchange.sendResponseHeaders(200, respuesta.getBytes().length);
                OutputStream os = exchange.getResponseBody();
                os.write(respuesta.getBytes());
                os.close();
            }
        }

        private int parsearEnteroSeguro(String valor) {
            try {
                if (valor == null || valor.trim().isEmpty())
                    return 0;
                return Integer.parseInt(valor.trim());
            } catch (NumberFormatException e) {
                return 0;
            }
        }

        private String extraerValorJson(String json, String clave) {
            try {
                String buscar = "\"" + clave + "\":\"";
                int inicio = json.indexOf(buscar);
                if (inicio == -1) {
                    buscar = "\"" + clave + "\":";
                    inicio = json.indexOf(buscar);
                    if (inicio == -1)
                        return "";
                    inicio += buscar.length();
                    int fin = json.indexOf(",", inicio);
                    if (fin == -1)
                        fin = json.indexOf("}", inicio);
                    if (fin == -1)
                        return "";
                    return json.substring(inicio, fin).trim().replace("\"", "");
                }
                inicio += buscar.length();
                int fin = json.indexOf("\"", inicio);
                if (fin == -1)
                    return "";
                return json.substring(inicio, fin);
            } catch (Exception e) {
                return "";
            }
        }
    }
}