require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuración de PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Verificar conexión a la base de datos
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error conectando a PostgreSQL:', err.stack);
    } else {
        console.log('✅ Conectado a PostgreSQL correctamente');
        release();
    }
});

// ============== API ENDPOINTS ==============

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', service: 'Toma de Medidas Flekk', timestamp: new Date() });
});

// Verificar si un SKU existe
app.get('/api/producto/:sku', async (req, res) => {
    const { sku } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT sku, alto, ancho, largo, tipo_empaque, fecha_registro FROM productos WHERE sku = $1',
            [sku]
        );
        
        if (result.rows.length > 0) {
            res.json({
                exists: true,
                producto: result.rows[0]
            });
        } else {
            res.json({
                exists: false,
                message: 'Producto no encontrado'
            });
        }
    } catch (error) {
        console.error('Error al buscar producto:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Registrar nuevo producto
app.post('/api/productos', async (req, res) => {
    const { sku, alto, ancho, largo, tipo_empaque } = req.body;
    
    // Validaciones
    if (!sku || !alto || !ancho || !largo || !tipo_empaque) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    
    if (alto <= 0 || ancho <= 0 || largo <= 0) {
        return res.status(400).json({ error: 'Las medidas deben ser mayores a 0' });
    }
    
    if (!['caja', 'bolsa', 'ninguno'].includes(tipo_empaque)) {
        return res.status(400).json({ error: 'Tipo de empaque no válido' });
    }
    
    try {
        // Verificar si ya existe
        const existing = await pool.query(
            'SELECT sku FROM productos WHERE sku = $1',
            [sku]
        );
        
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'El SKU ya existe en el sistema' });
        }
        
        // Insertar nuevo producto
        const result = await pool.query(
            `INSERT INTO productos (sku, alto, ancho, largo, tipo_empaque) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [sku, alto, ancho, largo, tipo_empaque]
        );
        
        res.status(201).json({
            message: 'Producto registrado exitosamente',
            producto: result.rows[0]
        });
    } catch (error) {
        console.error('Error al registrar producto:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Obtener todos los productos (para administración)
app.get('/api/productos', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM productos ORDER BY fecha_registro DESC LIMIT 100'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Obtener estadísticas
app.get('/api/estadisticas', async (req, res) => {
    try {
        const total = await pool.query('SELECT COUNT(*) FROM productos');
        const porEmpaque = await pool.query(
            'SELECT tipo_empaque, COUNT(*) FROM productos GROUP BY tipo_empaque'
        );
        
        res.json({
            total_productos: parseInt(total.rows[0].count),
            distribucion_empaques: porEmpaque.rows
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor Toma de Medidas Flekk corriendo en http://localhost:${port}`);
    console.log(`📊 API disponible en http://localhost:${port}/api`);
});