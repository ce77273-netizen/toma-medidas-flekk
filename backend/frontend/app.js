const API_URL = window.location.origin + '/api';
let currentSku = null;
let currentArticulo = null;
let selectedPack = null;
let html5QrCode = null;
let scannerActive = false;

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

// Crear sonido de escaneo
const scanSound = new Audio();
scanSound.src = 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3';
scanSound.volume = 0.7;

// Función para reproducir sonido
function playBeep() {
    try {
        scanSound.currentTime = 0;
        scanSound.play().catch(e => console.log('Error al reproducir sonido:', e));
    } catch(e) {}
}

// Función para vibrar (si está disponible)
function vibrate() {
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
}

// Función para validar código de barras
function validarCodigoBarras(code) {
    code = code.trim();
    if (!code) return false;
    
    // Formato: solo letras mayúsculas, números y guiones
    const formatoValido = /^[A-Z0-9\-]+$/.test(code);
    if (!formatoValido) return false;
    
    // Longitud entre 4 y 20 caracteres
    if (code.length < 4 || code.length > 20) return false;
    
    // Lista negra
    const codigosErrores = ['000000', '111111', '123456', '999999'];
    if (codigosErrores.includes(code)) return false;
    
    // Debe tener al menos una letra
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

// Abrir cámara con html5-qrcode
scanCameraBtn.onclick = async () => {
    await iniciarCamara();
};

// Cerrar cámara
closeCameraBtn.onclick = () => {
    detenerCamara();
};

// Iniciar cámara con html5-qrcode (más confiable)
async function iniciarCamara() {
    try {
        cameraContainer.style.display = 'block';
        scannerActive = true;
        
        html5QrCode = new Html5Qrcode("reader");
        
        const config = {
            fps: 15,
            qrbox: { width: 280, height: 120 },
            aspectRatio: 1.0,
            formatsToSupport: [ 
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.CODE_93,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODABAR,
                Html5QrcodeSupportedFormats.ITF,
                Html5QrcodeSupportedFormats.RSS_14,
                Html5QrcodeSupportedFormats.RSS_EXPANDED
            ]
        };
        
        // Obtener cámara trasera
        const cameraId = await getBackCamera();
        
        await html5QrCode.start(
            cameraId,
            config,
            (decodedText) => {
                if (!scannerActive) return;
                
                const code = decodedText.trim();
                
                if (validarCodigoBarras(code)) {
                    scannerActive = false;
                    playBeep();
                    vibrate();
                    detenerCamara();
                    skuInput.value = code;
                    verificarSku(code);
                } else {
                    showStatus('⚠️ Código no válido, intenta nuevamente', 'error');
                    setTimeout(() => {
                        if (statusDiv.innerHTML === '⚠️ Código no válido, intenta nuevamente') {
                            statusDiv.innerHTML = '';
                        }
                    }, 1500);
                }
            },
            (errorMessage) => {
                // Error de escaneo, ignorar
                console.log(errorMessage);
            }
        );
        
        showStatus('📷 Cámara activa. Apunta al código de barras.', '');
        
    } catch (error) {
        console.error('Error al iniciar cámara:', error);
        showStatus('Error al acceder a la cámara', 'error');
        detenerCamara();
    }
}

// Obtener cámara trasera
async function getBackCamera() {
    try {
        const devices = await Html5Qrcode.getCameras();
        
        if (!devices || devices.length === 0) {
            throw new Error('No se encontraron cámaras');
        }
        
        // Buscar cámara trasera
        let backCamera = devices.find(device => 
            device.label.toLowerCase().includes('back') ||
            device.label.toLowerCase().includes('environment') ||
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('trasera')
        );
        
        if (!backCamera) {
            backCamera = devices[0];
        }
        
        return backCamera.id;
        
    } catch (error) {
        console.error('Error obteniendo cámaras:', error);
        throw error;
    }
}

// Detener cámara
function detenerCamara() {
    scannerActive = false;
    
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            cameraContainer.style.display = 'none';
        }).catch(() => {
            cameraContainer.style.display = 'none';
        });
    } else {
        cameraContainer.style.display = 'none';
    }
    html5QrCode = null;
}

// Verificar código con el backend
async function verificarSku(sku) {
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
            playBeep();
            showAlert(dataProducto.producto);
        } else {
            playBeep();
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
