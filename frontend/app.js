// Configuración
const API_URL = window.location.origin + '/api';
let currentSku = null;
let selectedPackaging = null;

// Elementos DOM
const barcodeInput = document.getElementById('barcodeInput');
const scanBtn = document.getElementById('scanBtn');
const formSection = document.getElementById('formSection');
const displaySku = document.getElementById('displaySku');
const altoInput = document.getElementById('alto');
const anchoInput = document.getElementById('ancho');
const largoInput = document.getElementById('largo');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const existingAlert = document.getElementById('existingAlert');
const loadingOverlay = document.getElementById('loadingOverlay');

// Event Listeners
scanBtn.addEventListener('click', handleScan);
barcodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleScan();
});
saveBtn.addEventListener('click', saveProduct);
cancelBtn.addEventListener('click', resetForm);

// Packaging selection
document.querySelectorAll('.pack-option').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.pack-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPackaging = btn.dataset.pack;
    });
});

// Función para escanear/verificar SKU
async function handleScan() {
    const sku = barcodeInput.value.trim();
    if (!sku) {
        showStatus('Por favor ingresa o escanea un código SKU', 'error');
        return;
    }
    
    currentSku = sku;
    showLoading(true);
    
    try {
        const response = await fetch(`${API_URL}/producto/${encodeURIComponent(sku)}`);
        const data = await response.json();
        
        if (response.ok && data.exists) {
            // Producto ya existe
            showExistingProduct(data.producto);
        } else {
            // Producto nuevo
            showRegistrationForm(sku);
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error al conectar con el servidor. Verifica tu conexión.', 'error');
    } finally {
        showLoading(false);
    }
}

// Mostrar formulario de registro
function showRegistrationForm(sku) {
    formSection.style.display = 'block';
    displaySku.textContent = sku;
    resetFormFields();
    barcodeInput.value = '';
    showStatus('', '');
    
    // Limpiar mensajes anteriores
    const statusDiv = document.getElementById('scannerStatus');
    statusDiv.textContent = '';
    statusDiv.className = 'status-message';
    
    // Scroll suave al formulario
    setTimeout(() => {
        formSection.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    
    // Enfocar primera medida
    altoInput.focus();
}

// Mostrar producto existente
function showExistingProduct(producto) {
    const detailsDiv = document.getElementById('existingDetails');
    const tipoEmpaqueTexto = {
        'caja': '📦 Caja',
        'bolsa': '🛍️ Bolsa',
        'ninguno': '📦 Sin empaque'
    };
    
    detailsDiv.innerHTML = `
        <p><strong>📋 SKU:</strong> ${producto.sku}</p>
        <p><strong>📏 Medidas:</strong> ${producto.alto} cm × ${producto.ancho} cm × ${producto.largo} cm</p>
        <p><strong>📦 Empaque:</strong> ${tipoEmpaqueTexto[producto.tipo_empaque] || producto.tipo_empaque}</p>
        <p><strong>📅 Registrado:</strong> ${new Date(producto.fecha_registro).toLocaleDateString('es-ES')}</p>
    `;
    existingAlert.style.display = 'block';
    barcodeInput.value = '';
    barcodeInput.focus();
}

// Guardar producto
async function saveProduct() {
    const alto = parseFloat(altoInput.value);
    const ancho = parseFloat(anchoInput.value);
    const largo = parseFloat(largoInput.value);
    
    if (!selectedPackaging) {
        showStatus('Por favor selecciona el tipo de empaque', 'error');
        return;
    }
    
    if (isNaN(alto) || isNaN(ancho) || isNaN(largo)) {
        showStatus('Por favor ingresa todas las medidas válidas (números positivos)', 'error');
        return;
    }
    
    if (alto <= 0 || ancho <= 0 || largo <= 0) {
        showStatus('Las medidas deben ser mayores a 0', 'error');
        return;
    }
    
    const producto = {
        sku: currentSku,
        alto,
        ancho,
        largo,
        tipo_empaque: selectedPackaging
    };
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_URL}/productos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(producto)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatus('✅ Producto registrado exitosamente!', 'success');
            resetForm();
            setTimeout(() => {
                formSection.style.display = 'none';
                const statusDiv = document.getElementById('scannerStatus');
                statusDiv.textContent = '';
                statusDiv.className = 'status-message';
                barcodeInput.focus();
            }, 2000);
        } else {
            showStatus(data.error || 'Error al guardar el producto', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error de conexión con el servidor', 'error');
    } finally {
        showLoading(false);
    }
}

// Resetear formulario
function resetForm() {
    resetFormFields();
    currentSku = null;
    selectedPackaging = null;
    barcodeInput.value = '';
    barcodeInput.focus();
    formSection.style.display = 'none';
}

function resetFormFields() {
    altoInput.value = '';
    anchoInput.value = '';
    largoInput.value = '';
    document.querySelectorAll('.pack-option').forEach(b => b.classList.remove('active'));
}

// Mostrar mensaje de estado
function showStatus(message, type) {
    const statusDiv = document.getElementById('scannerStatus');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    if (message && type !== 'error') {
        setTimeout(() => {
            if (statusDiv.textContent === message) {
                statusDiv.textContent = '';
                statusDiv.className = 'status-message';
            }
        }, 3000);
    }
}

// Mostrar/ocultar loading
function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

// Cerrar alerta
window.closeAlert = function() {
    existingAlert.style.display = 'none';
    barcodeInput.focus();
};

// Inicializar
barcodeInput.focus();

// Soporte para escáner de código de barras físico
let barcodeBuffer = '';
let lastKeyTime = 0;

document.addEventListener('keydown', (e) => {
    // Detectar entrada de escáner de barras (generalmente rápida)
    const now = Date.now();
    if (now - lastKeyTime > 100) {
        // Si hay pausa larga, reiniciar buffer (probablemente tecleo manual)
        if (barcodeBuffer.length > 0) {
            barcodeBuffer = '';
        }
    }
    
    if (e.key === 'Enter') {
        if (barcodeBuffer.length > 0) {
            e.preventDefault();
            barcodeInput.value = barcodeBuffer;
            barcodeBuffer = '';
            handleScan();
        }
    } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
    }
    
    lastKeyTime = now;
});