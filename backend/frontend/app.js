const API_URL = window.location.origin + '/api';
let currentSku = null;
let currentArticulo = null;
let selectedPack = null;
let scannerActive = false;
let lastAcceptedCode = '';
let lastAcceptedTime = 0;

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

// Función para validar código de barras (rechaza QR)
function validarCodigoBarras(code) {
    code = code.trim();
    if (!code) return false;
    
    // Rechazar códigos muy largos (los QR suelen ser largos)
    if (code.length > 25) return false;
    
    // Formato: solo letras mayúsculas, números y guiones
    const formatoValido = /^[A-Z0-9\-]+$/.test(code);
    if (!formatoValido) return false;
    
    // Longitud entre 4 y 20 caracteres
    if (code.length < 4 || code.length > 20) return false;
    
    // Lista negra de códigos erróneos
    const codigosErrores = [
        '000000', '111111', '123456', '999999', '0000000000',
        '1111111111', '1234567890', '9999999999', '0000', '1111',
        '1234', '9999', '00000000', '11111111', '12345678'
    ];
    if (codigosErrores.includes(code)) return false;
    
    // Debe tener al menos una letra (los códigos de barras válidos tienen letras)
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

// Iniciar cámara con Quagga - Solo códigos de barras lineales
async function iniciarCamara() {
    try {
        cameraContainer.style.display = 'block';
        scannerActive = true;
        
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
                patchSize: "x-large",
                halfSample: false,
                debug: {
                    drawBoundingBox: false,
                    showFrequency: false,
                    drawScanline: false,
                    showPattern: false
                }
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
                    "upc_e_reader"
                ],
                debug: {
                    drawBoundingBox: false,
                    showFrequency: false,
                    drawScanline: false,
                    showPattern: false
                }
            },
            locate: true,
            frequency: 15
        }, function(err) {
            if (err) {
                console.error("Error inicializando Quagga:", err);
                showStatus('Error al iniciar escáner', 'error');
                detenerCamara();
                return;
            }
            
            Quagga.start();
            
            let detections = [];
            
            Quagga.onDetected(function(result) {
                if (!scannerActive) return;
                
                const code = result.codeResult.code;
                const confidence = result.codeResult.confidence || 0;
                const format = result.codeResult.format || '';
                const now = Date.now();
                
                // Solo procesar si es un código de barras (no QR)
                const isBarcode = format !== 'qr_code' && format !== 'qr' && format !== 'pdf417';
                
                if (code && code.length > 0 && confidence > 0.5 && isBarcode) {
                    detections.push({ code, time: now, confidence });
                    detections = detections.filter(d => now - d.time < 800);
                    
                    const sameCodeDetections = detections.filter(d => d.code === code);
                    
                    if (sameCodeDetections.length >= 3 && code !== lastAcceptedCode) {
                        const codigoValido = /^[A-Z0-9\-]+$/.test(code);
                        const longitudValida = code.length >= 4 && code.length <= 20;
                        const tieneLetra = /[A-Z]/.test(code);
                        
                        if (codigoValido && longitudValida && tieneLetra) {
                            lastAcceptedCode = code;
                            lastAcceptedTime = now;
                            scannerActive = false;
                            detenerCamara();
                            skuInput.value = code;
                            verificarSku(code);
                        }
                    }
                }
            });
            
            showStatus('Cámara activa. Enfoca el código de barras (ignora QR).', '');
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
    lastAcceptedCode = '';
    
    if (Quagga) {
        try {
            Quagga.stop();
        } catch(e) {}
    }
    
    cameraContainer.style.display = 'none';
}

// Verificar código con el backend
async function verificarSku(sku) {
    if (!validarCodigoBarras(sku)) {
        showStatus('⚠️ Código no válido. Escanea nuevamente.', 'error');
        skuInput.value = '';
        skuInput.focus();
        return;
    }
    
    showStatus('Buscando...', '');
    
    try {
        const resArticulo = await fetch(`${API_URL}/articulo/${encodeURIComponent(sku)}`);
        const dataArticulo = await resArticulo.json();
        
        if (dataArticulo.exists) {
            currentArticulo = dataArticulo.articulo;
        } else {
            currentArticulo = {
                codigo: sku,
                articulo: `📦 Producto: ${sku}`,
                disponible: 0
            };
        }
        
        const resProducto = await fetch(`${API_URL}/producto/${encodeURIComponent(sku)}`);
        const dataProducto = await resProducto.json();
        
        if (dataProducto.exists) {
            showAlert(dataProducto.producto);
        } else {
            const nombreArticulo = dataArticulo.exists ? currentArticulo.articulo : `📦 Producto: ${sku}`;
            showForm(sku, nombreArticulo);
        }
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error de conexión con el servidor', 'error');
    }
}

// Mostrar formulario
function showForm(sku, articuloNombre) {
    formContainer.style.display = 'block';
    displaySku.textContent = sku;
    displayArticulo.textContent = articuloNombre;
    currentSku = sku;
    statusDiv.innerHTML = '';
    skuInput.value = '';
    formContainer.scrollIntoView({ behavior: 'smooth' });
}

// Mostrar alerta
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

// Guardar producto
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
