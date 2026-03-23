-- Crear base de datos
CREATE DATABASE toma_medidas_flekk;

\c toma_medidas_flekk;

-- Crear tabla de productos
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    alto DECIMAL(10,2) NOT NULL,
    ancho DECIMAL(10,2) NOT NULL,
    largo DECIMAL(10,2) NOT NULL,
    tipo_empaque VARCHAR(20) NOT NULL CHECK (tipo_empaque IN ('caja', 'bolsa', 'ninguno')),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_registro VARCHAR(100) DEFAULT 'sistema'
);

-- Crear índices para búsquedas rápidas
CREATE INDEX idx_productos_sku ON productos(sku);
CREATE INDEX idx_productos_fecha ON productos(fecha_registro);

-- Insertar datos de ejemplo
INSERT INTO productos (sku, alto, ancho, largo, tipo_empaque) VALUES
('SKU-001', 25.5, 15.2, 10.0, 'caja'),
('SKU-002', 30.0, 20.0, 15.0, 'bolsa'),
('SKU-003', 10.0, 8.0, 5.0, 'ninguno')
ON CONFLICT (sku) DO NOTHING;

-- Crear usuario para la aplicación
CREATE USER flekk_user WITH PASSWORD 'flekk_pass_2024';
GRANT SELECT, INSERT, UPDATE ON productos TO flekk_user;
GRANT USAGE, SELECT ON SEQUENCE productos_id_seq TO flekk_user;