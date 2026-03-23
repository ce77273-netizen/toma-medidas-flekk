require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;  // Cambiado a 8080 como fallback

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Configuración de PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Verificar conexión a la base de datos
pool.connect((err) => {
    if (err) {
        console.error('❌ Error conectando a PostgreSQL:', err.message);
    } else {
        console.log('✅ Conectado a PostgreSQL correctamente');
    }
});

// ============== RUTA DE PRUEBA ==============
app.get('/', (req, res) => {
    res.send('✅ Servidor Toma de Medidas Flekk funcionando correctamente en puerto 8080');
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
            res.json({ exists: true, producto: result.rows[0] });
        } else {
            res.json({ exists: false });
        }
    } catch (error) {
        console.error('Error al buscar producto:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Registrar nuevo producto
app.post('/api/productos', async (req, res) => {
    const { sku, alto, ancho, largo, tipo_empaque } = req.body;
    
    if (!sku || !alto || !ancho || !largo || !tipo_empaque) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    
    if (alto <= 0 || ancho <= 0 || largo <= 0) {
        return res.status(400).json({ error: 'Las medidas deben ser mayores a 0' });
    }
    
    try {
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
        if (error.code === '23505') {
            res.status(409).json({ error: 'El SKU ya existe' });
        } else {
            console.error('Error al registrar:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
});

// Obtener todos los productos
app.get('/api/productos', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM productos ORDER BY fecha_registro DESC LIMIT 100'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Para cualquier otra ruta, servir index.html (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor Toma de Medidas Flekk corriendo en http://localhost:${port}`);
    console.log(`📊 API disponible en http://localhost:${port}/api`);
    console.log(`✅ Ruta de prueba: http://localhost:${port}/`);
});
