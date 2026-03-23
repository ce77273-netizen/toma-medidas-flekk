const API_URL = window.location.origin + '/api';
let currentSku = null;
let selectedPack = null;
let scannerActive = false;

// Elementos DOM
const skuInput = document.getElementById('skuInput');
const scanBtn = document.getElementById('scanBtn');
const scanCameraBtn = document.getElementById('scanCameraBtn');
const cameraContainer = document.getElementById('cameraContainer');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const formContainer = document.getElementById('formContainer');
const displaySku = document.getElementById('displaySku');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const statusDiv = document.getElementById('status');

// Verificar SKU manual
scanBtn.onclick = async () => {
    const sku = skuInput.value.trim();
    if (!sku) {
        showStatus('Ingresa un SKU', 'error');
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

// Iniciar cámara con Quagga (especializado en códigos de barras)
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
            
            // Detectar códigos
            Quagga.onDetected(function(result) {
                if (!scannerActive) return;
                
                const code = result.codeResult.code;
                if (code && code.length > 0) {
                    // Validar que el código tenga formato válido
                    const codigoValido = /^[A-Z0-9\-]+$/.test(code);
                    
                    if (codigoValido && code.length >= 4 && code.length <= 20) {
                        scannerActive = false;
                        detenerCamara();
                        skuInput.value = code;
                        verificarSku(code);
                    } else {
                        showStatus('⚠️ Escanea solo el código de barras', 'error');
                        // No detener la cámara, seguir escaneando
                    }
                }
            });
            
            showStatus('Cámara activa. Apunta al código de barras.', '');
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
    
    if (Quagga) {
        try {
            Quagga.stop();
        } catch(e) {}
    }
    
    cameraContainer.style.display = 'none';
}

// Verificar código con el backend (primero en artículos, luego en productos)
async function verificarSku(sku) {
    showStatus('Buscando artículo...', '');
    
    try {
        // Primero buscar en la tabla de artículos
        const resArticulo = await fetch(`${API_URL}/articulo/${encodeURIComponent(sku)}`);
        const dataArticulo = await resArticulo.json();
        
        if (dataArticulo.exists) {
            // Si existe el artículo, mostrarlo
            mostrarArticuloEncontrado(dataArticulo.articulo);
        } else {
            // Si no existe en artículos, buscar en productos (medidas)
            const resProducto = await fetch(`${API_URL}/producto/${encodeURIComponent(sku)}`);
            const dataProducto = await resProducto.json();
            
            if (dataProducto.exists) {
                showAlert(dataProducto.producto);
            } else {
                showStatus('Código no encontrado en el inventario', 'error');
                skuInput.value = '';
                skuInput.focus();
            }
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error de conexión con el servidor', 'error');
    }
}

// Mostrar artículo encontrado con opción de registrar medidas
function mostrarArticuloEncontrado(articulo) {
    const modal = document.getElementById('alertModal');
    const details = document.getElementById('alertDetails');
    
    details.innerHTML = `
        <p><strong>📦 Artículo:</strong> ${articulo.articulo}</p>
        <p><strong>📊 Disponible:</strong> ${articulo.disponible} unidades</p>
        <p><strong>🔢 Código:</strong> ${articulo.codigo}</p>
        <hr>
        <p style="margin-top: 10px;"><strong>¿Deseas registrar las medidas de este producto?</strong></p>
    `;
    
    // Cambiar el botón para que muestre opciones
    const modalContent = document.querySelector('#alertModal .modal-content');
    const oldButton = modalContent.querySelector('button');
    
    if (oldButton) {
        oldButton.remove();
    }
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginTop = '15px';
    
    const siBtn = document.createElement('button');
    siBtn.textContent = '✅ Sí, registrar medidas';
    siBtn.style.background = '#2EC4B6';
    siBtn.style.flex = '1';
    siBtn.style.padding = '12px';
    siBtn.style.border = 'none';
    siBtn.style.borderRadius = '12px';
    siBtn.style.fontWeight = '600';
    siBtn.style.cursor = 'pointer';
    siBtn.onclick = () => {
        document.getElementById('alertModal').style.display = 'none';
        showForm(articulo.codigo);
    };
    
    const noBtn = document.createElement('button');
    noBtn.textContent = '❌ No, solo verificar';
    noBtn.style.background = '#6c757d';
    noBtn.style.flex = '1';
    noBtn.style.padding = '12px';
    noBtn.style.border = 'none';
    noBtn.style.borderRadius = '12px';
    noBtn.style.fontWeight = '600';
    noBtn.style.cursor = 'pointer';
    noBtn.style.color = 'white';
    noBtn.onclick = () => {
        document.getElementById('alertModal').style.display = 'none';
        showStatus('Artículo verificado', 'success');
        skuInput.value = '';
        skuInput.focus();
    };
    
    buttonContainer.appendChild(siBtn);
    buttonContainer.appendChild(noBtn);
    modalContent.appendChild(buttonContainer);
    
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
            showStatus('✅ Producto guardado!', 'success');
            setTimeout(() => {
                formContainer.style.display = 'none';
                skuInput.value = '';
                skuInput.focus();
                resetForm();
            }, 1500);
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
};

// Selección de tipo de empaque
document.querySelectorAll('.packBtn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.packBtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPack = btn.dataset.pack;
    };
});

function showForm(sku) {
    formContainer.style.display = 'block';
    displaySku.textContent = sku;
    currentSku = sku;
    statusDiv.innerHTML = '';
    skuInput.value = '';
    formContainer.scrollIntoView({ behavior: 'smooth' });
}

function showAlert(producto) {
    const modal = document.getElementById('alertModal');
    const details = document.getElementById('alertDetails');
    const tipoTexto = { caja: '📦 Caja', bolsa: '🛍️ Bolsa', ninguno: '📦 Sin empaque' };
    
    details.innerHTML = `
        <p><strong>SKU:</strong> ${producto.sku}</p>
        <p><strong>Medidas:</strong> ${producto.alto} x ${producto.ancho} x ${producto.largo} cm</p>
        <p><strong>Empaque:</strong> ${tipoTexto[producto.tipo_empaque] || producto.tipo_empaque}</p>
        <p><strong>Registrado:</strong> ${new Date(producto.fecha_registro).toLocaleDateString()}</p>
    `;
    
    // Asegurar que el modal tenga un solo botón
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
        skuInput.focus();
    };
    
    modalContent.appendChild(closeBtn);
    document.getElementById('alertModal').style.display = 'flex';
    skuInput.value = '';
}

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
};

skuInput.focus();
