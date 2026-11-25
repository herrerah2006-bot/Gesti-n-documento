package servidor;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import com.empresa.conexion.Conexion;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import javax.mail.Authenticator;
import javax.mail.Message;
import javax.mail.MessagingException;
import javax.mail.PasswordAuthentication;
import javax.mail.Session;
import javax.mail.Transport;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;

public class ServidorWeb {
    private static final String CORREO_ADMIN_DESTINO = System.getenv().getOrDefault("ADMIN_EMAIL", "ygx890@gmail.com");
    private static final String SMTP_USUARIO = System.getenv().getOrDefault("SMTP_USER", "");
    private static final String SMTP_CLAVE = System.getenv().getOrDefault("SMTP_PASS", "");
    private static final String SMTP_HOST = System.getenv().getOrDefault("SMTP_HOST", "smtp.gmail.com");
    private static final String SMTP_PORT = System.getenv().getOrDefault("SMTP_PORT", "587");
    private static final String URL_BASE_API = System.getenv().getOrDefault("BACKEND_URL", "http://localhost:8080");
    private static final int MAX_ADMINISTRADORES = 3;

    private static final Map<String, SolicitudPendiente> SOLICITUDES_PENDIENTES = new ConcurrentHashMap<>();

    static class SolicitudPendiente {
        final String token;
        final String correo;
        final String rol;
        final String contrasenaTemporal;

        SolicitudPendiente(String token, String correo, String rol, String contrasenaTemporal) {
            this.token = token;
            this.correo = correo;
            this.rol = rol;
            this.contrasenaTemporal = contrasenaTemporal;
        }
    }

    private static String generarContrasenaSistema() {
        return "Sys#" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    public static void main(String[] args) throws IOException {
        int puerto = 8080;
        HttpServer servidor = HttpServer.create(new InetSocketAddress(puerto), 0);

        servidor.createContext("/api/clientes", new IndexacionHandler());
        servidor.createContext("/api/control-tiempos", new ControlTiemposHandler());
        servidor.createContext("/api/usuarios/registro", new RegistroUsuarioHandler());
        servidor.createContext("/api/usuarios/solicitud", new ObtenerSolicitudHandler());
        servidor.createContext("/api/usuarios/aprobar", new AprobarUsuarioHandler());
        servidor.createContext("/api/usuarios/login", new LoginUsuarioHandler());
        servidor.createContext("/api/usuarios/cambiar-clave", new CambiarClaveHandler());
        servidor.createContext("/", new ArchivosEstaticosHandler());

        servidor.setExecutor(null);
        servidor.start();

        System.out.println("==================================================");
        System.out.println(" Servidor Backend Activo en: http://localhost:" + puerto);
        System.out.println("==================================================");
    }

    private static Path resolverCarpetaFrontend() {
        String rutaEnv = System.getenv("FRONTEND_DIR");
        if (rutaEnv != null && !rutaEnv.trim().isEmpty()) {
            return Paths.get(rutaEnv.trim()).toAbsolutePath().normalize();
        }

        String[] candidatos = {
            "GestorDocumental frontend_web",
            "gestordocumental/GestorDocumental frontend_web",
            "gestordocumental/GestorDocumental/frontend_web",
            "gestordocumental/GestorDocumental \\ frontend_web",
            "C:\\GestorDocumental\\gestordocumental\\GestorDocumental frontend_web",
            "C:\\GestorDocumental\\gestordocumental\\GestorDocumental\\frontend_web"
        };

        for (String c : candidatos) {
            File f = new File(c);
            if (f.exists() && f.isDirectory()) {
                return f.toPath().toAbsolutePath().normalize();
            }
        }

        return Paths.get("GestorDocumental frontend_web").toAbsolutePath().normalize();
    }

    static class ArchivosEstaticosHandler implements HttpHandler {
        private final Path carpetaBase = resolverCarpetaFrontend();

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String rutaUri = exchange.getRequestURI().getPath();
            if (rutaUri == null || rutaUri.equals("/")) {
                rutaUri = "/login.html";
            }

            String relativa = URLDecoder.decode(rutaUri, StandardCharsets.UTF_8).replaceFirst("^/+", "");
            Path archivoSolicitado = carpetaBase.resolve(relativa).normalize();

            if (!archivoSolicitado.startsWith(carpetaBase)) {
                enviarTexto(exchange, 403, "Acceso denegado.");
                return;
            }

            File archivo = archivoSolicitado.toFile();
            if (!archivo.exists() || archivo.isDirectory()) {
                enviarTexto(exchange, 404, "Archivo no encontrado: " + relativa);
                return;
            }

            String contentType = obtenerContentType(archivo.getName());
            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(200, archivo.length());

            try (FileInputStream fis = new FileInputStream(archivo);
                 OutputStream os = exchange.getResponseBody()) {
                byte[] buffer = new byte[4096];
                int leidos;
                while ((leidos = fis.read(buffer)) != -1) {
                    os.write(buffer, 0, leidos);
                }
            }
        }

        private String obtenerContentType(String nombre) {
            String n = nombre.toLowerCase();
            if (n.endsWith(".html")) return "text/html; charset=UTF-8";
            if (n.endsWith(".js")) return "application/javascript; charset=UTF-8";
            if (n.endsWith(".css")) return "text/css; charset=UTF-8";
            if (n.endsWith(".json")) return "application/json; charset=UTF-8";
            if (n.endsWith(".png")) return "image/png";
            if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
            if (n.endsWith(".svg")) return "image/svg+xml";
            return "application/octet-stream";
        }

        private void enviarTexto(HttpExchange exchange, int codigo, String texto) throws IOException {
            byte[] bytes = texto.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=UTF-8");
            exchange.sendResponseHeaders(codigo, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }
    }

    private static void enviarCorreoAsync(String para, String asunto, String cuerpoTexto) {
        new Thread(() -> enviarCorreo(para, asunto, cuerpoTexto), "hilo-correo-smtp").start();
    }

    private static void enviarCorreo(String para, String asunto, String cuerpoTexto) {
        if (SMTP_USUARIO.isEmpty() || SMTP_CLAVE.isEmpty()) {
            System.out.println("========================================");
            System.out.println(" [AVISO CORREO - SMTP NO CONFIGURADO]");
            System.out.println(" Para: " + para);
            System.out.println(" Asunto: " + asunto);
            System.out.println(cuerpoTexto);
            System.out.println("========================================");
            return;
        }

        boolean usarSsl = "465".equals(SMTP_PORT.trim());
        Properties props = new Properties();
        props.put("mail.smtp.host", SMTP_HOST);
        props.put("mail.smtp.port", SMTP_PORT);
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.connectiontimeout", "10000");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.writetimeout", "10000");
        props.put("mail.smtp.ssl.trust", SMTP_HOST);
        if (usarSsl) {
            props.put("mail.smtp.ssl.enable", "true");
        } else {
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.starttls.required", "true");
        }

        Session session = Session.getInstance(props, new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(SMTP_USUARIO, SMTP_CLAVE);
            }
        });

        try {
            Message mensaje = new MimeMessage(session);
            mensaje.setFrom(new InternetAddress(SMTP_USUARIO));
            mensaje.setRecipients(Message.RecipientType.TO, InternetAddress.parse(para));
            mensaje.setSubject(asunto);
            mensaje.setText(cuerpoTexto);
            Transport.send(mensaje);
            System.out.println("✔ Correo enviado a: " + para);
        } catch (MessagingException e) {
            System.err.println("⚠ Error al enviar correo a " + para + ": " + e.getMessage());
        }
    }

    private static boolean existeUsuarioEnBd(Connection conn, String usuarioCedula) throws SQLException {
        String sql = "SELECT COUNT(*) FROM db_gestor_documental.usuarios WHERE LOWER(usuario_cedula) = LOWER(?)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, usuarioCedula);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getInt(1) > 0;
            }
        }
    }

    private static String obtenerTokenQuery(HttpExchange exchange) {
        String query = exchange.getRequestURI().getRawQuery();
        if (query == null) return "";
        for (String par : query.split("&")) {
            String[] kv = par.split("=", 2);
            if (kv.length == 2 && kv[0].equals("token")) {
                return URLDecoder.decode(kv[1], StandardCharsets.UTF_8).trim();
            }
        }
        return "";
    }

    private static String leerCuerpo(HttpExchange exchange) throws IOException {
        InputStreamReader isr = new InputStreamReader(exchange.getRequestBody(), StandardCharsets.UTF_8);
        BufferedReader br = new BufferedReader(isr);
        StringBuilder sb = new StringBuilder();
        String linea;
        while ((linea = br.readLine()) != null) {
            sb.append(linea);
        }
        return sb.toString();
    }

    private static String escaparJson(String texto) {
        if (texto == null) return "";
        return texto.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static void enviarJson(HttpExchange exchange, int codigoEstado, String json) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(codigoEstado, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String extraerValorJson(String json, String clave) {
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

    static class ObtenerSolicitudHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");

            if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            String token = obtenerTokenQuery(exchange);
            SolicitudPendiente solicitud = token.isEmpty() ? null : SOLICITUDES_PENDIENTES.get(token);

            if (solicitud == null) {
                enviarJson(exchange, 404, "{\"status\": \"error\", \"mensaje\": \"Solicitud no encontrada o ya aprobada.\"}");
                return;
            }

            String json = "{\"status\": \"success\", \"correo\": \"" + escaparJson(solicitud.correo)
                    + "\", \"rol\": \"" + escaparJson(solicitud.rol)
                    + "\", \"contrasenaTemporal\": \"" + escaparJson(solicitud.contrasenaTemporal) + "\"}";
            enviarJson(exchange, 200, json);
        }
    }

    static class AprobarUsuarioHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");

            if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if (!exchange.getRequestMethod().equalsIgnoreCase("POST")) {
                enviarJson(exchange, 405, "{\"status\": \"error\", \"mensaje\": \"Método no permitido.\"}");
                return;
            }

            String body = leerCuerpo(exchange);
            String token = extraerValorJson(body, "token").trim();
            String usuarioAsignado = extraerValorJson(body, "usuario").trim();

            SolicitudPendiente solicitud = token.isEmpty() ? null : SOLICITUDES_PENDIENTES.get(token);
            if (solicitud == null) {
                enviarJson(exchange, 404, "{\"status\": \"error\", \"mensaje\": \"Solicitud no encontrada o ya procesada.\"}");
                return;
            }

            if (usuarioAsignado.isEmpty()) {
                enviarJson(exchange, 400, "{\"status\": \"error\", \"mensaje\": \"Debe ingresar un nombre de usuario.\"}");
                return;
            }

            String contrasenaAsignada = solicitud.contrasenaTemporal;

            String sqlExisteCorreo = "SELECT COUNT(*) FROM db_gestor_documental.usuarios WHERE LOWER(correo) = LOWER(?)";
            String sqlContarAdmins = "SELECT COUNT(*) FROM db_gestor_documental.usuarios WHERE rol = 'administrador'";
            String sqlInsert = "INSERT INTO db_gestor_documental.usuarios (usuario_cedula, correo, contrasena, rol, activo, debe_cambiar_clave) VALUES (?, ?, ?, ?, 1, 1)";

            try (Connection conn = Conexion.obtenerConexion()) {
                if (conn == null) {
                    enviarJson(exchange, 500, "{\"status\": \"error\", \"mensaje\": \"No se pudo conectar a la base de datos.\"}");
                    return;
                }

                try (PreparedStatement psExiste = conn.prepareStatement(sqlExisteCorreo)) {
                    psExiste.setString(1, solicitud.correo);
                    try (ResultSet rs = psExiste.executeQuery()) {
                        if (rs.next() && rs.getInt(1) > 0) {
                            SOLICITUDES_PENDIENTES.remove(token);
                            enviarJson(exchange, 409, "{\"status\": \"error\", \"mensaje\": \"Ese correo ya fue registrado en MySQL.\"}");
                            return;
                        }
                    }
                }

                if (existeUsuarioEnBd(conn, usuarioAsignado)) {
                    enviarJson(exchange, 409, "{\"status\": \"error\", \"mensaje\": \"Ese nombre de usuario ya está en uso. Elige otro.\"}");
                    return;
                }

                if (solicitud.rol.equals("administrador")) {
                    try (PreparedStatement psAdmins = conn.prepareStatement(sqlContarAdmins);
                         ResultSet rsAdmins = psAdmins.executeQuery()) {
                        if (rsAdmins.next() && rsAdmins.getInt(1) >= MAX_ADMINISTRADORES) {
                            enviarJson(exchange, 400, "{\"status\": \"error\", \"mensaje\": \"Ya se alcanzó el límite máximo de administradores.\"}");
                            return;
                        }
                    }
                }

                try (PreparedStatement pstmt = conn.prepareStatement(sqlInsert)) {
                    pstmt.setString(1, usuarioAsignado);
                    pstmt.setString(2, solicitud.correo);
                    pstmt.setString(3, contrasenaAsignada);
                    pstmt.setString(4, solicitud.rol);
                    pstmt.executeUpdate();
                }

                SOLICITUDES_PENDIENTES.remove(token);

                String enlaceLogin = URL_BASE_API + "/login.html";
                String cuerpoUsuario = "Tu solicitud de acceso al Centro de Gestión Documental ha sido aprobada.\n\n"
                        + "Nombre de usuario asignado: " + usuarioAsignado + "\n"
                        + "Contraseña inicial del sistema: " + contrasenaAsignada + "\n"
                        + "Rol: " + solicitud.rol + "\n\n"
                        + "Ingresa a la aplicación aquí:\n"
                        + enlaceLogin + "\n\n"
                        + "Al ingresar a la aplicación con esta contraseña, podrás cambiarla desde el sistema.\n"
                        + "Tu nombre de usuario asignado no podrá modificarse.\n";
                enviarCorreoAsync(solicitud.correo, "Credenciales de acceso - Centro de Gestión Documental", cuerpoUsuario);

                enviarJson(exchange, 200, "{\"status\": \"success\", \"mensaje\": \"Usuario aprobado, guardado en MySQL y credenciales enviadas por correo.\"}");
            } catch (SQLException e) {
                System.err.println("⚠ Error SQL al aprobar solicitud: " + e.getMessage());
                e.printStackTrace();
                enviarJson(exchange, 500, "{\"status\": \"error\", \"mensaje\": \"Error en base de datos al aprobar la solicitud.\"}");
            }
        }
    }

    static class LoginUsuarioHandler implements HttpHandler {
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
                String jsonRecibido = leerCuerpo(exchange);
                String usuarioIngresado = extraerValorJson(jsonRecibido, "usuario").trim();
                String contrasenaIngresada = extraerValorJson(jsonRecibido, "contrasena").trim();

                String mensajeCredenciales = "Credenciales incorrectas.";
                String mensajeInactivo = "Usuario no activo.";

                if (usuarioIngresado.isEmpty() || contrasenaIngresada.isEmpty()) {
                    enviarJson(exchange, 400, "{\"status\": \"error\", \"motivo\": \"credenciales\", \"mensaje\": \"" + mensajeCredenciales + "\"}");
                    return;
                }

                String sql = "SELECT usuario_cedula, correo, rol, activo, debe_cambiar_clave FROM db_gestor_documental.usuarios "
                        + "WHERE (usuario_cedula = ? OR LOWER(correo) = LOWER(?)) AND contrasena = ? LIMIT 1";

                try (Connection conn = Conexion.obtenerConexion()) {
                    if (conn == null) {
                        enviarJson(exchange, 500, "{\"status\": \"error\", \"motivo\": \"credenciales\", \"mensaje\": \"" + mensajeCredenciales + "\"}");
                        return;
                    }

                    try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                        pstmt.setString(1, usuarioIngresado);
                        pstmt.setString(2, usuarioIngresado);
                        pstmt.setString(3, contrasenaIngresada);

                        try (ResultSet rs = pstmt.executeQuery()) {
                            if (!rs.next()) {
                                enviarJson(exchange, 401, "{\"status\": \"error\", \"motivo\": \"credenciales\", \"mensaje\": \"" + mensajeCredenciales + "\"}");
                                return;
                            }

                            int activo = rs.getInt("activo");
                            if (activo != 1) {
                                enviarJson(exchange, 403, "{\"status\": \"error\", \"motivo\": \"inactivo\", \"mensaje\": \"" + mensajeInactivo + "\"}");
                                return;
                            }

                            int debeCambiar = rs.getInt("debe_cambiar_clave");
                            String userDb = escaparJson(rs.getString("usuario_cedula"));
                            String correoDb = escaparJson(rs.getString("correo"));
                            String rolDb = escaparJson(rs.getString("rol"));

                            String respuestaOk = "{\"status\": \"success\", \"usuario\": \"" + userDb
                                    + "\", \"correo\": \"" + correoDb
                                    + "\", \"rol\": \"" + rolDb
                                    + "\", \"activo\": " + activo
                                    + ", \"debeCambiarClave\": " + (debeCambiar == 1) + "}";
                            enviarJson(exchange, 200, respuestaOk);
                        }
                    }
                } catch (SQLException e) {
                    System.err.println("⚠ Error SQL en login: " + e.getMessage());
                    e.printStackTrace();
                    enviarJson(exchange, 500, "{\"status\": \"error\", \"motivo\": \"credenciales\", \"mensaje\": \"" + mensajeCredenciales + "\"}");
                }
            } else {
                String respuesta = "Endpoint Login de Usuarios - Activo";
                exchange.sendResponseHeaders(200, respuesta.getBytes().length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(respuesta.getBytes());
                }
            }
        }
    }

    static class CambiarClaveHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");

            if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if (!exchange.getRequestMethod().equalsIgnoreCase("POST")) {
                enviarJson(exchange, 405, "{\"status\": \"error\", \"mensaje\": \"Método no permitido.\"}");
                return;
            }

            String body = leerCuerpo(exchange);
            String usuario = extraerValorJson(body, "usuario").trim();
            String claveActual = extraerValorJson(body, "claveActual").trim();
            String nuevaClave = extraerValorJson(body, "nuevaClave").trim();

            if (usuario.isEmpty() || claveActual.isEmpty() || nuevaClave.length() < 4) {
                enviarJson(exchange, 400, "{\"status\": \"error\", \"mensaje\": \"Complete todos los campos. La nueva contraseña debe tener al menos 4 caracteres.\"}");
                return;
            }

            String sqlVerificar = "SELECT id FROM db_gestor_documental.usuarios WHERE usuario_cedula = ? AND contrasena = ? AND activo = 1 LIMIT 1";
            String sqlActualizar = "UPDATE db_gestor_documental.usuarios SET contrasena = ?, debe_cambiar_clave = 0 WHERE id = ?";

            try (Connection conn = Conexion.obtenerConexion()) {
                if (conn == null) {
                    enviarJson(exchange, 500, "{\"status\": \"error\", \"mensaje\": \"No se pudo conectar a la base de datos.\"}");
                    return;
                }

                int idUsuario = -1;
                try (PreparedStatement psVer = conn.prepareStatement(sqlVerificar)) {
                    psVer.setString(1, usuario);
                    psVer.setString(2, claveActual);
                    try (ResultSet rs = psVer.executeQuery()) {
                        if (!rs.next()) {
                            enviarJson(exchange, 401, "{\"status\": \"error\", \"mensaje\": \"La contraseña actual no es correcta.\"}");
                            return;
                        }
                        idUsuario = rs.getInt("id");
                    }
                }

                try (PreparedStatement psUpd = conn.prepareStatement(sqlActualizar)) {
                    psUpd.setString(1, nuevaClave);
                    psUpd.setInt(2, idUsuario);
                    psUpd.executeUpdate();
                }

                enviarJson(exchange, 200, "{\"status\": \"success\", \"mensaje\": \"Contraseña actualizada correctamente.\"}");
            } catch (SQLException e) {
                System.err.println("⚠ Error SQL al cambiar contraseña: " + e.getMessage());
                e.printStackTrace();
                enviarJson(exchange, 500, "{\"status\": \"error\", \"mensaje\": \"Error en base de datos al actualizar contraseña.\"}");
            }
        }
    }

    static class RegistroUsuarioHandler implements HttpHandler {
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
                String jsonRecibido = leerCuerpo(exchange);
                System.out.println("----------------------------------------");
                System.out.println(" ¡Solicitud de Usuario recibida en Java!");
                System.out.println(jsonRecibido);
                System.out.println("----------------------------------------");

                String correo = extraerValorJson(jsonRecibido, "correo").trim().toLowerCase();
                String rol = extraerValorJson(jsonRecibido, "rol").trim();

                if (correo.isEmpty() || rol.isEmpty()) {
                    enviarJson(exchange, 400, "{\"status\": \"error\", \"mensaje\": \"Datos de solicitud incompletos.\"}");
                    return;
                }

                if (!rol.equals("administrador") && !rol.equals("usuario") && !rol.equals("lector")) {
                    enviarJson(exchange, 400, "{\"status\": \"error\", \"mensaje\": \"Rol no válido.\"}");
                    return;
                }

                String sqlExisteCorreo = "SELECT COUNT(*) FROM db_gestor_documental.usuarios WHERE LOWER(correo) = LOWER(?)";
                String sqlContarAdmins = "SELECT COUNT(*) FROM db_gestor_documental.usuarios WHERE rol = 'administrador'";

                try (Connection conn = Conexion.obtenerConexion()) {
                    if (conn == null) {
                        System.out.println("⚠ No se pudo conectar a la base de datos.");
                        enviarJson(exchange, 500, "{\"status\": \"error\", \"mensaje\": \"No se pudo conectar a la base de datos.\"}");
                        return;
                    }

                    try (PreparedStatement psExiste = conn.prepareStatement(sqlExisteCorreo)) {
                        psExiste.setString(1, correo);
                        try (ResultSet rs = psExiste.executeQuery()) {
                            if (rs.next() && rs.getInt(1) > 0) {
                                enviarJson(exchange, 409, "{\"status\": \"error\", \"mensaje\": \"Ya existe un usuario registrado con ese correo electrónico.\"}");
                                return;
                            }
                        }
                    }

                    if (rol.equals("administrador")) {
                        try (PreparedStatement psAdmins = conn.prepareStatement(sqlContarAdmins);
                             ResultSet rsAdmins = psAdmins.executeQuery()) {
                            if (rsAdmins.next() && rsAdmins.getInt(1) >= MAX_ADMINISTRADORES) {
                                enviarJson(exchange, 400, "{\"status\": \"error\", \"mensaje\": \"Ya se alcanzó el límite máximo de administradores.\"}");
                                return;
                            }
                        }
                    }

                    String token = UUID.randomUUID().toString();
                    String contrasenaSistema = generarContrasenaSistema();
                    SOLICITUDES_PENDIENTES.put(token, new SolicitudPendiente(token, correo, rol, contrasenaSistema));

                    String enlaceAplicacion = URL_BASE_API + "/login.html?aprobarToken=" + token;
                    String cuerpoAdmin = "Hola administrador, te llegó una nueva solicitud de acceso al Centro de Gestión Documental:\n\n"
                            + "Correo solicitante: " + correo + "\n"
                            + "Rol solicitado: " + rol + "\n\n"
                            + "Abrir aplicación para asignar usuario y aprobar:\n"
                            + enlaceAplicacion + "\n";

                    enviarCorreoAsync(CORREO_ADMIN_DESTINO, "Nueva solicitud de acceso - " + rol, cuerpoAdmin);

                    enviarJson(exchange, 200, "{\"status\": \"pending\", \"mensaje\": \"Solicitud enviada al administrador para aprobación.\"}");
                } catch (SQLException e) {
                    System.err.println("⚠ Error SQL al validar solicitud: " + e.getMessage());
                    e.printStackTrace();
                    enviarJson(exchange, 500, "{\"status\": \"error\", \"mensaje\": \"Error en base de datos al procesar la solicitud.\"}");
                }
            } else {
                String respuesta = "Endpoint Registro de Usuarios - Activo";
                exchange.sendResponseHeaders(200, respuesta.getBytes().length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(respuesta.getBytes());
                }
            }
        }
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
                String jsonRecibido = leerCuerpo(exchange);
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

                enviarJson(exchange, 200, respuestaJson);
            } else if (exchange.getRequestMethod().equalsIgnoreCase("GET")) {
                StringBuilder sb = new StringBuilder("[");
                String sql = "SELECT no_folio, fecha_proceso, fecha_contrato, distribuidor_id, cliente_id, observaciones, nombre_empresa, codigo_empresa, area_empresa, archivo, drive_url FROM documentos ORDER BY id DESC";

                try (Connection conn = Conexion.obtenerConexion()) {
                    if (conn != null) {
                        try (PreparedStatement pstmt = conn.prepareStatement(sql);
                             ResultSet rs = pstmt.executeQuery()) {
                            boolean primero = true;
                            while (rs.next()) {
                                if (!primero) sb.append(",");
                                primero = false;
                                sb.append("{")
                                  .append("\"nroContrato\":\"").append(escaparJson(rs.getString("no_folio"))).append("\",")
                                  .append("\"fechaProceso\":\"").append(escaparJson(rs.getString("fecha_proceso"))).append("\",")
                                  .append("\"fechaContrato\":\"").append(escaparJson(rs.getString("fecha_contrato"))).append("\",")
                                  .append("\"nroDistribuidor\":\"").append(escaparJson(rs.getString("distribuidor_id"))).append("\",")
                                  .append("\"nombreCliente\":\"").append(escaparJson(rs.getString("cliente_id"))).append("\",")
                                  .append("\"observaciones\":\"").append(escaparJson(rs.getString("observaciones"))).append("\",")
                                  .append("\"nombreEmpresa\":\"").append(escaparJson(rs.getString("nombre_empresa"))).append("\",")
                                  .append("\"codigoEmpresa\":\"").append(escaparJson(rs.getString("codigo_empresa"))).append("\",")
                                  .append("\"areaEmpresa\":\"").append(escaparJson(rs.getString("area_empresa"))).append("\",")
                                  .append("\"archivo\":\"").append(escaparJson(rs.getString("archivo"))).append("\",")
                                  .append("\"driveUrl\":\"").append(escaparJson(rs.getString("drive_url"))).append("\"")
                                  .append("}");
                            }
                        }
                    }
                } catch (SQLException e) {
                    System.err.println("⚠ Error SQL al consultar documentos: " + e.getMessage());
                    e.printStackTrace();
                }

                sb.append("]");
                enviarJson(exchange, 200, sb.toString());
            } else {
                String respuesta = "API del Gestor Documental - Funcionando correctamente";
                exchange.sendResponseHeaders(200, respuesta.getBytes().length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(respuesta.getBytes());
                }
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
                String jsonRecibido = leerCuerpo(exchange);
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

                enviarJson(exchange, 200, respuestaJson);
            } else {
                String respuesta = "Endpoint Control de Tiempos - Activo";
                exchange.sendResponseHeaders(200, respuesta.getBytes().length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(respuesta.getBytes());
                }
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
    }
}