const API_URL = window.location.origin + '/api';
let currentSku = null;
let selectedPack = null;
let html5QrCode = null;

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

// Iniciar cámara con html5-qrcode
async function iniciarCamara() {
    try {
        cameraContainer.style.display = 'block';
        
        html5QrCode = new Html5Qrcode("reader");
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 100 },
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
        
        // Forzar cámara trasera
        const cameraId = await getBackCamera();
        
        await html5QrCode.start(
            cameraId,
            config,
            (decodedText) => {
                // Código detectado
                detenerCamara();
                skuInput.value = decodedText;
                verificarSku(decodedText);
            },
            (errorMessage) => {
                // Error de escaneo, ignorar
                console.log(errorMessage);
            }
        );
        
        showStatus('Cámara activa. Apunta al código de barras.', '');
        
    } catch (error) {
        console.error('Error al iniciar cámara:', error);
        showStatus('Error al acceder a la cámara. Verifica los permisos.', 'error');
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
        
        // Si no hay trasera, usar la primera
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

// Verificar SKU con el backend
async function verificarSku(sku) {
    showStatus('Buscando...', '');
    
    try {
        const res = await fetch(`${API_URL}/producto/${encodeURIComponent(sku)}`);
        const data = await res.json();
        
        if (data.exists) {
            showAlert(data.producto);
        } else {
            showForm(sku);
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error de conexión con el servidor', 'error');
    }
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
    modal.style.display = 'flex';
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
