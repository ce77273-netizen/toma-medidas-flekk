# Toma de Medidas Flekk

Sistema para gestión de medidas de productos mediante escáner de código de barras.

## Características
- Escaneo de códigos de barras SKU
- Registro de medidas (alto, ancho, largo)
- Clasificación por tipo de empaque (caja/bolsa/sin empaque)
- Validación de productos duplicados
- Interfaz moderna y responsiva

## Tecnologías
- Frontend: HTML5, CSS3, JavaScript
- Backend: Node.js, Express
- Base de datos: PostgreSQL
- Despliegue: EasyPanel

## Instalación Local

1. Clonar repositorio
2. Configurar variables de entorno en `/backend/.env`
3. Ejecutar `docker-compose up -d`
4. Acceder a `http://localhost:3000`

## API Endpoints

- `GET /api/producto/:sku` - Verificar existencia
- `POST /api/productos` - Registrar producto
- `GET /api/productos` - Listar productos
- `GET /api/estadisticas` - Obtener estadísticas