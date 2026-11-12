package com.empresa.dao;

import com.empresa.conexion.Conexion;
import com.empresa.cliente.Cliente;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

public class ClienteDao {

    // Método para insertar un cliente en la base de datos
    public boolean insertarCliente(Cliente cliente) {
        String sql = "INSERT INTO clientes (cedula_ruc, cliente_nombre) VALUES (?, ?)";
        
        try (Connection con = Conexion.obtenerConexion();
             PreparedStatement pstmt = con.prepareStatement(sql)) {
            
            pstmt.setString(1, cliente.getCedulaRuc());
            pstmt.setString(2, cliente.getClienteNombre());
            
            pstmt.executeUpdate();
            return true;
            
        } catch (SQLException e) {
            System.err.println("Error al insertar cliente: " + e.getMessage());
            return false;
        }
    }
}