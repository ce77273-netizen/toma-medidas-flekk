const API_URL = window.location.origin + '/api';
let currentSku = null;
let currentArticulo = null;
let selectedPack = null;
let scanner = null;
let barcodeBuffer = '';
let barcodeTimer = null;
let isHardwareScanner = false;

// Elementos DOM
const skuInput = document.getElementById('skuInput');
const scanBtn = document.getElementById('scanBtn');
const scanCameraBtn = document.getElementById('scanCameraBtn');
const cameraContainer = document.getElementById('cameraContainer');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const video = document.getElementById('scanner-video');
const formContainer = document.getElementById('formContainer');
const displaySku = document.getElementById('displaySku');
const displayArticulo = document.getElementById('displayArticulo');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const statusDiv = document.getElementById('status');

// Sonido
const scanSound = new Audio();
scanSound.src = 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3';
scanSound.volume = 0.7;

function playBeep() {
    try {
        scanSound.currentTime = 0;
        scanSound.play().catch(e => console.log('Error:', e));
    } catch(e) {}
}

function vibrate() {
    if (navigator.vibrate) navigator.vibrate(200);
}

function validarCodigoBarras(code) {
    code = code.trim();
    if (!code) return false;
    if (!/^[A-Z0-9\-]+$/.test(code)) return false;
    if (code.length < 4 || code.length > 20) return false;
    if (['000000', '111111', '123456', '999999'].includes(code)) return false;
    if (!/[A-Z]/.test(code)) return false;
    return true;
}

// Detectar lector de código de barras Honeywell / Zebra / Socket
function detectarLectorHardware() {
    const ua = navigator.userAgent;
    
    // Dispositivos con lector integrado
    const dispositivosLector = [
        'Honeywell', 'Zebra', 'Symbol', 'Motorola', 
        'TC70', 'TC75', 'MC92', 'MC33', 'MC40', 'WT41',
        'Socket', 'CS3070', 'DS6878', 'LS2208'
    ];
    
    const tieneLector = dispositivosLector.some(device => ua.includes(device));
    
    if (tieneLector) {
        isHardwareScanner = true;
        showStatus('📟 Lector Honeywell/Zebra detectado. Usa el gatillo.', 'success');
        return true;
    }
    
    // Detectar si es un lector USB (prueba rápida)
    if (!/Android|iPhone|iPad/i.test(ua)) {
        isHardwareScanner = true;
        showStatus('🖥️ Modo escritorio - puedes usar lector USB', 'success');
        return true;
    }
    
    isHardwareScanner = false;
    showStatus('📱 Usando cámara para escanear', '');
    return false;
}

// Configurar escucha para lectores Honeywell (simulan teclado)
function configurarLectorHardware() {
    let inputBuffer = '';
    let lastKeyTime = 0;
    
    document.addEventListener('keydown', (e) => {
        const now = Date.now();
        
        // Si es lector hardware o es un escaneo rápido
        if (isHardwareScanner || (now - lastKeyTime < 50 && e.key !== 'Enter')) {
            
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
                e.preventDefault();
            } 
            else if (e.key.length === 1 && /[A-Z0-9\-]/i.test(e.key)) {
                inputBuffer += e.key.toUpperCase();
                
                // Timeout para limpiar buffer si es muy lento
                clearTimeout(barcodeTimer);
                barcodeTimer = setTimeout(() => {
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
        showStatus('⚠️ Formato no válido', 'error');
        skuInput.value = '';
        skuInput.focus();
        return;
    }
    await verificarSku(sku);
};

// Abrir cámara (solo si no hay lector hardware)
scanCameraBtn.onclick = async () => {
    if (isHardwareScanner) {
        showStatus('📟 Usa el gatillo del lector Honeywell/Zebra', 'error');
        return;
    }
    await iniciarCamara();
};

closeCameraBtn.onclick = () => {
    detenerCamara();
};

// Iniciar cámara con Instascan
async function iniciarCamara() {
    try {
        cameraContainer.style.display = 'block';
        
        scanner = new Instascan.Scanner({ 
            video: video,
            mirror: false,
            backgroundScan: false,
            continuous: true
        });
        
        scanner.addListener('scan', function(content) {
            const code = content.trim();
            if (validarCodigoBarras(code)) {
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
        });
        
        const cameras = await Instascan.Camera.getCameras();
        
        if (cameras.length === 0) {
            showStatus('No se encontró cámara', 'error');
            detenerCamara();
            return;
        }
        
        // Buscar cámara trasera
        let backCamera = cameras.find(camera => 
            camera.name.toLowerCase().includes('back') ||
            camera.name.toLowerCase().includes('environment') ||
            camera.name.toLowerCase().includes('rear')
        );
        
        if (!backCamera) {
            backCamera = cameras[0];
        }
        
        await scanner.start(backCamera);
        showStatus('📷 Cámara activa. Apunta al código de barras.', '');
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error al acceder a la cámara', 'error');
        detenerCamara();
    }
}

function detenerCamara() {
    if (scanner) {
        try {
            scanner.stop();
        } catch(e) {}
        scanner = null;
    }
    cameraContainer.style.display = 'none';
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
            showStatus('✅ Medidas registradas!', 'success');
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

// Inicializar
detectarLectorHardware();
configurarLectorHardware();
skuInput.focus();
