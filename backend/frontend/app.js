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

scanCameraBtn.onclick = async () => {
    await iniciarCamara();
};

closeCameraBtn.onclick = () => {
    detenerCamara();
};

// Iniciar cámara con Quagga2 optimizado
async function iniciarCamara() {
    try {
        cameraContainer.style.display = 'block';
        scannerActive = true;
        
        // Configuración optimizada para códigos de barras
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.querySelector('#interactive'),
                constraints: {
                    facingMode: "environment",
                    width: { min: 640, ideal: 1280, max: 1920 },
                    height: { min: 480, ideal: 720, max: 1080 },
                    aspectRatio: { ideal: 1.7777777778 }
                },
            },
            locator: {
                patchSize: "x-large",
                halfSample: true,
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
            locate: true,
            frequency: 15
        }, function(err) {
            if (err) {
                console.error("Error:", err);
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
                const now = Date.now();
                
                if (code && code.length > 0 && confidence > 0.65) {
                    detections.push({ code, time: now, confidence });
                    detections = detections.filter(d => now - d.time < 800);
                    
                    const sameCodeDetections = detections.filter(d => d.code === code);
                    
                    if (sameCodeDetections.length >= 2 && code !== lastCode) {
                        if (validarCodigoBarras(code)) {
                            lastCode = code;
                            lastCodeTime = now;
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
                            }, 1000);
                        }
                    }
                }
            });
            
            showStatus('📷 Cámara activa. Enfoca el código de barras.', '');
        });
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error al acceder a la cámara', 'error');
        detenerCamara();
    }
}

function detenerCamara() {
    scannerActive = false;
    lastCode = '';
    if (Quagga) {
        try {
            Quagga.stop();
        } catch(e) {}
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

skuInput.focus();
