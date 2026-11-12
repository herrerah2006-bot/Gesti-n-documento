package com.empresa.conexion; // Asegúrate de ajustar el nombre del paquete según tu estructura

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class Conexion {
    private static final String URL = "jdbc:mysql://localhost:3306/db_documentos_inteligente?useSSL=false&serverTimezone=UTC";
    private static final String USUARIO = "root";
    private static final String CLAVE = "12345678"; // Reemplaza esto con tu contraseña real de MySQL

    public static Connection obtenerConexion() {
        try {
            Connection conexion = DriverManager.getConnection(URL, USUARIO, CLAVE);
            return conexion;
        } catch (SQLException e) {
            System.err.println("Error al conectar a la base de datos: " + e.getMessage());
            return null;
        }
    }
}
