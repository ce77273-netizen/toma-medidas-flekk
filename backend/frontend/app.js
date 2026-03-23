const API_URL = window.location.origin + '/api';
let currentSku = null;
let currentArticulo = null;
let selectedPack = null;
let scannerActive = false;
let lastCode = '';
let lastCodeTime = 0;

// Elementos DOM
const skuInput = document.getElementById('skuInput');
const scanBtn = document.getElementById('scanBtn');
const scanCameraBtn = document.getElementById('scanCameraBtn');
const cameraContainer = document.getElementById('cameraContainer');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const formContainer = document.getElementById('formContainer');
const displaySku = document.getElementById('displaySku');
const displayArticulo = document.getElementById('displayArticulo');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const statusDiv = document.getElementById('status');

// Función para validar código de barras
function validarCodigoBarras(code) {
    // Eliminar espacios en blanco
    code = code.trim();
    
    // Verificar que no esté vacío
    if (!code) return false;
    
    // Verificar formato: solo letras mayúsculas, números y guiones
    const formatoValido = /^[A-Z0-9\-]+$/.test(code);
    if (!formatoValido) return false;
    
    // Verificar longitud: entre 4 y 20 caracteres
    if (code.length < 4 || code.length > 20) return false;
    
    // Lista negra de códigos comunes que son errores de escaneo
    const codigosErrores = [
        '000000', '111111', '123456', '999999', '0000000000',
        '1111111111', '1234567890', '9999999999', '0000', '1111',
        '1234', '9999', '00000000', '11111111', '12345678'
    ];
    if (codigosErrores.includes(code)) return false;
    
    // Verificar que tenga al menos una letra (no sea solo números)
    const tieneLetra = /[A-Z]/.test(code);
    if (!tieneLetra) return false;
    
    return true;
}

// Verificar SKU manual
scanBtn.onclick = async () => {
    const sku = skuInput.value.trim();
    if (!sku) {
        showStatus('Ingresa un SKU', 'error');
        return;
    }
    
    if (!validarCodigoBarras(sku)) {
        showStatus('⚠️ Formato de código no válido', 'error');
        skuInput.value = '';
        skuInput.focus();
        return;
    }
    
    await verificarSku(sku);
};

// Abrir cámara
scanCameraBtn.onclick = async () => {
    await iniciarCamara();
};

// Cerrar cámara
closeCameraBtn.onclick = () => {
    detenerCamara();
};

// Iniciar cámara con Quagga (versión mejorada)
async function iniciarCamara() {
    try {
        cameraContainer.style.display = 'block';
        scannerActive = true;
        
        // Configuración de Quagga
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.querySelector('#scanner-container'),
                constraints: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
            },
            locator: {
                patchSize: "medium",
                halfSample: true
            },
            numOfWorkers: navigator.hardwareConcurrency || 4,
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "code_39_reader",
                    "code_93_reader",
                    "codabar_reader",
                    "upc_reader",
                    "upc_e_reader",
                    "i2of5_reader"
                ],
                debug: {
                    drawBoundingBox: false,
                    showFrequency: false,
                    drawScanline: false,
                    showPattern: false
                }
            },
            locate: true
        }, function(err) {
            if (err) {
                console.error("Error inicializando Quagga:", err);
                showStatus('Error al iniciar escáner', 'error');
                detenerCamara();
                return;
            }
            
            Quagga.start();
            
            // Detectar códigos con validación mejorada
            Quagga.onDetected(function(result) {
                if (!scannerActive) return;
                
                const code = result.codeResult.code;
                const now = Date.now();
                
                if (code && code.length > 0) {
                    // Validar formato del código
                    const codigoValido = /^[A-Z0-9\-]+$/.test(code);
                    
                    // Validar longitud
                    const longitudValida = code.length >= 4 && code.length <= 20;
                    
                    // Validar que no sea el mismo código repetido en menos de 2 segundos
                    const noRepetido = (code !== lastCode) || (now - lastCodeTime > 2000);
                    
                    // Lista de códigos comunes que son errores
                    const codigosErrores = ['000000', '111111', '123456', '999999', '0000000000', '1111111111'];
                    const noEsError = !codigosErrores.includes(code);
                    
                    // Verificar que tenga al menos una letra
                    const tieneLetra = /[A-Z]/.test(code);
                    
                    if (codigoValido && longitudValida && noRepetido && noEsError && tieneLetra) {
                        lastCode = code;
                        lastCodeTime = now;
                        scannerActive = false;
                        detenerCamara();
                        skuInput.value = code;
                        verificarSku(code);
                    } else {
                        // Mostrar mensaje solo si es un código que parece válido pero no pasa filtros
                        if (code.length >= 4 && code.length <= 20 && !tieneLetra) {
                            showStatus('⚠️ Código inválido (solo números). Escanea el código de barras correcto.', 'error');
                        } else if (code.length > 0 && code.length < 20) {
                            // No mostrar mensaje para lecturas muy cortas
                        }
                        // No detener la cámara, seguir escaneando
                    }
                }
            });
            
            showStatus('Cámara activa. Apunta al código de barras principal.', '');
        });
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error al acceder a la cámara', 'error');
        detenerCamara();
    }
}

// Detener cámara
function detenerCamara() {
    scannerActive = false;
    lastCode = '';
    lastCodeTime = 0;
    
    if (Quagga) {
        try {
            Quagga.stop();
        } catch(e) {}
    }
    
    cameraContainer.style.display = 'none';
}

// Verificar código con el backend
async function verificarSku(sku) {
    // Validar el código antes de buscar
    if (!validarCodigoBarras(sku)) {
        showStatus('⚠️ Código de barras no válido. Escanea nuevamente.', 'error');
        skuInput.value = '';
        skuInput.focus();
        return;
    }
    
    showStatus('Buscando...', '');
    
    try {
        // 1. Buscar el artículo en la tabla de artículos
        const resArticulo = await fetch(`${API_URL}/articulo/${encodeURIComponent(sku)}`);
        const dataArticulo = await resArticulo.json();
        
        if (!dataArticulo.exists) {
            showStatus('Código no encontrado en el inventario', 'error');
            skuInput.value = '';
            skuInput.focus();
            return;
        }
        
        // Guardar el artículo encontrado
        currentArticulo = dataArticulo.articulo;
        
        // 2. Verificar si ya tiene medidas registradas
        const resProducto = await fetch(`${API_URL}/producto/${encodeURIComponent(sku)}`);
        const dataProducto = await resProducto.json();
        
        if (dataProducto.exists) {
            // Ya tiene medidas, mostrar alerta
            showAlert(dataProducto.producto);
        } else {
            // No tiene medidas, mostrar formulario con el artículo
            showForm(sku, currentArticulo.articulo);
        }
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error de conexión con el servidor', 'error');
    }
}

// Mostrar formulario con SKU y Artículo
function showForm(sku, articuloNombre) {
    formContainer.style.display = 'block';
    displaySku.textContent = sku;
    displayArticulo.textContent = articuloNombre;
    currentSku = sku;
    statusDiv.innerHTML = '';
    skuInput.value = '';
    formContainer.scrollIntoView({ behavior: 'smooth' });
}

// Mostrar alerta de producto ya registrado
function showAlert(producto) {
    const modal = document.getElementById('alertModal');
    const details = document.getElementById('alertDetails');
    const tipoTexto = { caja: '📦 Caja', bolsa: '🛍️ Bolsa', ninguno: '📦 Sin empaque' };
    
    details.innerHTML = `
        <p><strong>📦 Artículo:</strong> ${currentArticulo?.articulo || producto.sku}</p>
        <p><strong>📏 Medidas:</strong> ${producto.alto} x ${producto.ancho} x ${producto.largo} cm</p>
        <p><strong>📦 Empaque:</strong> ${tipoTexto[producto.tipo_empaque] || producto.tipo_empaque}</p>
        <p><strong>📅 Registrado:</strong> ${new Date(producto.fecha_registro).toLocaleDateString()}</p>
    `;
    
    const modalContent = document.querySelector('#alertModal .modal-content');
    const existingButtons = modalContent.querySelectorAll('button');
    existingButtons.forEach(btn => btn.remove());
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Aceptar';
    closeBtn.style.background = 'linear-gradient(135deg, #FF6B35, #2EC4B6)';
    closeBtn.style.padding = '12px';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '12px';
    closeBtn.style.fontWeight = '600';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.marginTop = '15px';
    closeBtn.style.width = '100%';
    closeBtn.onclick = () => {
        document.getElementById('alertModal').style.display = 'none';
        skuInput.value = '';
        skuInput.focus();
        currentArticulo = null;
    };
    
    modalContent.appendChild(closeBtn);
    document.getElementById('alertModal').style.display = 'flex';
    skuInput.value = '';
}

// Guardar producto (medidas)
saveBtn.onclick = async () => {
    const alto = parseFloat(document.getElementById('alto').value);
    const ancho = parseFloat(document.getElementById('ancho').value);
    const largo = parseFloat(document.getElementById('largo').value);
    
    if (!selectedPack) {
        showStatus('Selecciona tipo de empaque', 'error');
        return;
    }
    
    if (isNaN(alto) || isNaN(ancho) || isNaN(largo) || alto <= 0 || ancho <= 0 || largo <= 0) {
        showStatus('Ingresa medidas válidas (mayores a 0)', 'error');
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/productos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sku: currentSku,
                alto, ancho, largo,
                tipo_empaque: selectedPack
            })
        });
        
        if (res.ok) {
            showStatus('✅ Medidas registradas correctamente!', 'success');
            setTimeout(() => {
                formContainer.style.display = 'none';
                skuInput.value = '';
                skuInput.focus();
                resetForm();
                currentArticulo = null;
            }, 2000);
        } else {
            const error = await res.json();
            showStatus(error.error || 'Error al guardar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error al guardar', 'error');
    }
};

cancelBtn.onclick = () => {
    formContainer.style.display = 'none';
    skuInput.value = '';
    skuInput.focus();
    resetForm();
    currentArticulo = null;
};

// Selección de tipo de empaque
document.querySelectorAll('.packBtn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.packBtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPack = btn.dataset.pack;
    };
});

function showStatus(msg, type) {
    statusDiv.innerHTML = msg;
    statusDiv.className = `status ${type}`;
    if (msg && type !== 'error') {
        setTimeout(() => {
            if (statusDiv.innerHTML === msg) {
                statusDiv.innerHTML = '';
                statusDiv.className = 'status';
            }
        }, 3000);
    }
}

function resetForm() {
    document.getElementById('alto').value = '';
    document.getElementById('ancho').value = '';
    document.getElementById('largo').value = '';
    document.querySelectorAll('.packBtn').forEach(b => b.classList.remove('active'));
    selectedPack = null;
    currentSku = null;
}

window.closeModal = () => {
    document.getElementById('alertModal').style.display = 'none';
    skuInput.focus();
    currentArticulo = null;
};

skuInput.focus();
