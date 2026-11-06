# Tienda Web

Tienda en línea con catálogo, carrito, pedidos y reseñas. API REST en Express y frontend en JavaScript nativo.

## Requisitos
- Node.js 18 o superior

## Uso
```bash
cp .env.example .env     # definir valores reales
npm install
SESSION_SECRET=un-valor-largo ADMIN_PASSWORD=MiClaveSegura1 npm start
```
La aplicación queda disponible en http://localhost:3000.

## Estructura
```
server.js             Punto de entrada, autenticación y utilidades
src/db.js             Esquema y datos iniciales (SQLite en memoria)
src/routes/api.js     Endpoints /api (catálogo, carrito, pedidos, reseñas)
src/services/         Lógica de negocio
src/middleware/       Logger y manejo de errores
public/               Frontend (HTML, CSS y módulos JS)
files/                Documentos descargables (términos, privacidad, envíos)
```
