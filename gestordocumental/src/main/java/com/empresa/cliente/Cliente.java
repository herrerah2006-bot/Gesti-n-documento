package com.empresa.cliente;

public class Cliente {
    private int id;
    private String cedulaRuc;
    private String clienteNombre;

    // Constructor vacío
    public Cliente() {}

    // Constructor con parámetros
    public Cliente(String cedulaRuc, String clienteNombre) {
        this.cedulaRuc = cedulaRuc;
        this.clienteNombre = clienteNombre;
    }

    // Getters y Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getCedulaRuc() { return cedulaRuc; }
    public void setCedulaRuc(String cedulaRuc) { this.cedulaRuc = cedulaRuc; }

    public String getClienteNombre() { return clienteNombre; }
    public void setClienteNombre(String clienteNombre) { this.clienteNombre = clienteNombre; }
}
