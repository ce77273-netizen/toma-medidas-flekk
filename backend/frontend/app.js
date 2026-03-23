const API_URL = window.location.origin + '/api';
let currentSku = null;
let currentArticulo = null;
let selectedPack = null;
let html5QrCode = null;
let scannerActive = false;
let barcodeBuffer = '';
let barcodeTimer = null;
let isBarcodeScanner = false;

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

// Sonido de escaneo
const scanSound = new Audio();
scanSound.src = 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3';
scanSound.volume = 0.7;

function playBeep() {
    try {
        scanSound.currentTime = 0;
        scanSound.play().catch(e => console.log('Error al reproducir sonido:', e));
    } catch(e) {}
}

function vibrate() {
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
}

function validarCodigoBarras(code) {
    code = code.trim();
    if (!code) return false;
    const formatoValido = /^[A-Z0-9\-]+$/.test(code);
    if (!formatoValido) return false;
    if (code.length < 4 || code.length > 20) return false;
    const codigosErrores = ['000000', '111111', '123456', '999999'];
    if (codigosErrores.includes(code)) return false;
    const tieneLetra = /[A-Z]/.test(code);
    if (!tieneLetra) return false;
    return true;
}

// Detectar si hay lector de código de barras integrado (Honeywell, Zebra, etc.)
function detectarBarcodeScanner() {
    // Verificar si es un dispositivo móvil sin lector integrado
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Dispositivos conocidos con lector integrado
    const scannerDevices = /Honeywell|Zebra|Symbol|Motorola|TC70|TC75|MC92|MC33|MC40|WT41/i.test(navigator.userAgent);
    
    if (scannerDevices) {
        isBarcodeScanner = true;
        showStatus('📟 Lector de código de barras detectado. Usa el gatillo del dispositivo.', 'success');
        return true;
    }
    
    // En dispositivos móviles sin lector, usamos cámara
    if (isMobile && !scannerDevices) {
        isBarcodeScanner = false;
        showStatus('📱 Usa la cámara para escanear', '');
        return false;
    }
    
    // En computadoras, puede ser lector USB
    isBarcodeScanner = false;
    return false;
}

// Configurar escucha de lectores USB (Honeywell, Zebra, etc.)
function setupBarcodeListener() {
    let inputBuffer = '';
    let lastKeyTime = 0;
    
    document.addEventListener('keydown', (e) => {
        const now = Date.now();
        
        // Si es un dispositivo con lector o es un lector USB (escaneo rápido)
        if (isBarcodeScanner || (now - lastKeyTime < 50 && e.key !== 'Enter')) {
            e.preventDefault();
            
            if (e.key === 'Enter') {
                if (inputBuffer.length >= 4) {
                    const code = inputBuffer.trim();
                    inputBuffer = '';
                    if (validarCodigoBarras(code)) {
                        playBeep();
                        vibrate();
                        skuInput.value = code;
                        verificarSku(code);
                    } else {
                        showStatus('⚠️ Código no válido', 'error');
                    }
                } else {
                    inputBuffer = '';
                }
            } else if (e.key.length === 1 && /[A-Z0-9\-]/i.test(e.key)) {
                inputBuffer += e.key.toUpperCase();
                setTimeout(() => {
                    if (inputBuffer.length > 0 && inputBuffer.length < 4) {
                        inputBuffer = '';
                    }
                }, 100);
            }
            lastKeyTime = now;
        }
    });
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

// Abrir cámara (solo para móviles sin lector)
scanCameraBtn.onclick = async () => {
    if (isBarcodeScanner) {
        showStatus('📟 Este dispositivo tiene lector integrado. Usa el gatillo físico.', 'error');
        return;
    }
    await iniciarCamara();
};

closeCameraBtn.onclick = () => {
    detenerCamara();
};

// Iniciar cámara con html5-qrcode
async function iniciarCamara() {
    try {
        cameraContainer.style.display = 'block';
        scannerActive = true;
        
        html5QrCode = new Html5Qrcode("reader");
        
        const config = {
            fps: 20,
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
                    showStatus('⚠️ Código no válido', 'error');
                    setTimeout(() => {
                        if (statusDiv.innerHTML === '⚠️ Código no válido') {
                            statusDiv.innerHTML = '';
                        }
                    }, 1500);
                }
            },
            (errorMessage) => {
                console.log(errorMessage);
            }
        );
        
        showStatus('📷 Cámara activa. Apunta al código de barras.', '');
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error al acceder a la cámara', 'error');
        detenerCamara();
    }
}

async function getBackCamera() {
    try {
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
            throw new Error('No se encontraron cámaras');
        }
        let backCamera = devices.find(device => 
            device.label.toLowerCase().includes('back') ||
            device.label.toLowerCase().includes('environment') ||
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('trasera')
        );
        if (!backCamera) backCamera = devices[0];
        return backCamera.id;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

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

async function verificarSku(sku) {
    showStatus('Buscando...', '');
    try {
        const resArticulo = await fetch(`${API_URL}/articulo/${encodeURIComponent(sku)}`);
        const dataArticulo = await resArticulo.json();
        
        if (dataArticulo.exists) {
            currentArticulo = dataArticulo.articulo;
        } else {
            currentArticulo = { codigo: sku, articulo: `📦 Producto: ${sku}`, disponible: 0 };
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

function showForm(sku, articuloNombre) {
    formContainer.style.display = 'block';
    displaySku.textContent = sku;
    displayArticulo.textContent = articuloNombre;
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

// Inicialización
detectarBarcodeScanner();
setupBarcodeListener();
skuInput.focus();
