# MediCore — Sistema de Gestión de Clínica

Sistema web para gestión clínica con Supabase Auth y Supabase Database

## 🚀 Acceso rápido

- **URL Supabase:** `https://ygjncrvfousrhobgzadr.supabase.co`
- **Abrir:** `login.html` en el navegador (o subir a GitHub Pages)

## 👤 Usuario de prueba

Crear uno desde la pantalla de registro o directamente en Supabase Authentication.

## 🗃️ Base de datos

Ejecutar el SQL del schema (incluido por separado) en **Supabase → SQL Editor**.

## 📁 Estructura

```
medicore/
├── shared.css          → Estilos globales
├── shared.js           → Supabase config, helpers, data layer
├── auth.js             → Login, registro, sesión, roles
├── login.html/js       → Pantalla de autenticación
├── index.html          → Dashboard de inicio
├── pacientes.html/js   → Módulo 01: Pacientes
├── citas.html/js       → Módulo 02: Citas
├── sala-espera.html/js → Módulo 03: Sala de Espera
├── historial.html/js   → Módulo 04: Historial Clínico
└── reportes.html/js    → Módulo 05: Reportes
```

## 🔐 Roles

| Rol           | Acceso                                    |
|---------------|-------------------------------------------|
| Administrador | Todo el sistema                           |
| Recepcionista | Pacientes, Citas, Sala de Espera          |
| Médico        | Sala de Espera, Historial                 |
| Enfermería    | Sala de Espera, datos básicos             |

## ⚙️ Flujo principal

1. Registrar paciente → Módulo 01
2. Crear cita → Módulo 02
3. Enviar a sala de espera → Módulo 02 (botón "Sala de espera")
4. Atender → Módulo 03 (botón "Atender" / "Finalizar")
5. Registrar historial → Módulo 04
6. Ver reportes → Módulo 05
